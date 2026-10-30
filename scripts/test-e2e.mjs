// scripts/test-e2e.mjs
//
// Test de bout en bout : chaque constat traverse les 3 tools enchaînés,
// exactement comme le ferait un client MCP réel.
//   analyze_claim_report -> classify_claim_severity -> generate_broker_notification
// Usage :
//   npm run build && npm run test:e2e                            (stdio, lance dist/index.js)
//   npm run test:e2e -- --url http://localhost:3000/mcp          (Streamable HTTP)
//   npm run test:e2e -- --only motard-blesse                     (un seul scénario)
// Coût : environ 5 centimes par scénario (Haiku 3 fois, Sonnet 1 fois).
// En HTTP, le token est lu dans MCP_AUTH_TOKEN (.env) et envoyé en Bearer.
//
// Les sorties des LLM varient d'un appel à l'autre : on ne compare jamais le texte,
// on vérifie des propriétés métier qui doivent tenir à chaque fois.

import "dotenv/config";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
  ClaimDataSchema,
  ClassificationResultSchema,
} from "../dist/types/claim.schemas.js";

const argValue = (flag) => {
  const i = process.argv.indexOf(flag);
  return i !== -1 ? process.argv[i + 1] : undefined;
};
const url = argValue("--url");
const only = argValue("--only");

// Données fictives : noms, plaques, numéros de contrat et téléphones sont inventés.
const scenarios = [
  {
    id: "parking-rayure",
    title: "Accrochage sur un parking, constat signé sans désaccord",
    claimId: "CLM-2026-10481",
    expect: {
      injuries: false,
      allowedSeverities: ["AUTO_PROCESS", "REVIEW_NEEDED"],
      minVehicles: 2,
    },
    rawText: `CONSTAT AMIABLE D'ACCIDENT AUTOMOBILE
Date : 03/10/2026, vers 17h40. Lieu : parking du centre commercial Carrefour Villiers-en-Bière (77), allée F.
Blessés, même légers : NON. Dégâts matériels à des véhicules autres que A et B : NON. Dégâts à des objets autres que des véhicules : NON.
Témoins : aucun.

VÉHICULE A
Conducteur : Mme Claire Dubreuil, née le 14/06/1984, 12 rue des Tilleuls, 77000 Melun. Tél : 06 00 00 41 12.
Véhicule : Renault Captur, immatriculé GH-482-KL.
Assureur : AXA France, contrat n° AXA-7781-2209, agence Melun Centre.
Circonstances cochées : case 2 (quittait un stationnement), case 15 (reculait).
Point de choc initial : arrière gauche. Dégâts apparents : pare-choc arrière rayé sur environ 20 cm, pas de déformation.

VÉHICULE B
Conducteur : M. Karim Benali, né le 02/11/1991, 4 allée des Peupliers, 77190 Dammarie-les-Lys. Tél : 06 00 00 87 30.
Véhicule : Toyota Yaris, immatriculé FS-219-PM.
Assureur : MAIF, contrat n° MAIF-5530-118.
Circonstances cochées : case 1 (en stationnement, à l'arrêt).
Point de choc initial : portière avant droite. Dégâts apparents : rayure superficielle sur la portière, rétroviseur intact.

OBSERVATIONS
A : "En reculant pour sortir de ma place, je n'ai pas vu le véhicule B garé derrière moi en épi. Je reconnais être responsable."
B : "J'étais à l'arrêt, moteur coupé, j'attendais ma femme. Rien à ajouter, je suis d'accord avec la description."
Croquis : véhicule A en marche arrière, véhicule B stationné perpendiculairement. Le constat est signé par les deux conducteurs, sans réserve.`,
  },
  {
    id: "carrefour-litige",
    title: "Collision à un carrefour, deux versions contradictoires",
    claimId: "CLM-2026-10527",
    expect: {
      injuries: false,
      allowedSeverities: ["REVIEW_NEEDED"],
      minVehicles: 2,
    },
    rawText: `CONSTAT AMIABLE D'ACCIDENT AUTOMOBILE
Date : 14/10/2026, vers 08h15. Lieu : carrefour avenue Jean-Jaurès / rue Paul-Bert, 69007 Lyon. Carrefour équipé de feux tricolores. Pluie, chaussée mouillée.
Blessés, même légers : NON. Dégâts matériels à des véhicules autres que A et B : NON. Dégâts à des objets autres que des véhicules : OUI, un potelet de trottoir arraché.
Témoins : M. Julien Morel, 9 rue Chevreul, 69007 Lyon, tél 06 00 00 15 64, piéton sur le passage clouté au moment du choc.

VÉHICULE A
Conducteur : M. Thomas Girard, né le 21/03/1979, 31 rue de Marseille, 69007 Lyon. Tél : 06 00 00 22 08.
Véhicule : Peugeot 3008, immatriculé EK-604-TR.
Assureur : Groupama Rhône-Alpes Auvergne, contrat n° GRA-90412-77.
Circonstances cochées : case 17 (venait de droite dans un carrefour).
Point de choc initial : avant droit. Dégâts apparents : pare-choc avant arraché, phare droit brisé, aile avant droite enfoncée, airbag non déclenché.

VÉHICULE B
Conducteur : Mme Sophie Lambert, née le 08/09/1996, 5 place Jean-Macé, 69007 Lyon. Tél : 06 00 00 73 49.
Véhicule : Volkswagen Golf, immatriculé FB-331-NC.
Assureur : MACIF, contrat n° MACIF-2207-6631.
Circonstances cochées : case 10 (changeait de file), case 13 (roulait sur une voie différente).
Point de choc initial : flanc gauche. Dégâts apparents : portières avant et arrière gauches enfoncées, montant central déformé, le véhicule a ensuite heurté un potelet.

OBSERVATIONS
A : "Le feu était vert pour moi. Le véhicule B a coupé ma voie en se rabattant brusquement pour tourner à gauche."
B : "Je suis passée à l'orange, c'est A qui a démarré trop tôt avant que le feu ne passe au vert de son côté. Je conteste la version de A."
Le témoin indique avoir vu le véhicule B s'engager "alors que le feu piéton venait de passer au vert", ce qui contredit la version de B.
Croquis non signé par B. Le constat porte la mention "désaccord sur les circonstances". Les deux véhicules ont été remorqués.`,
  },
  {
    id: "motard-blesse",
    title: "Refus de priorité, motard blessé et hospitalisé",
    claimId: "CLM-2026-10590",
    expect: {
      injuries: true,
      allowedSeverities: ["URGENT_ESCALATION"],
      minVehicles: 2,
    },
    rawText: `CONSTAT AMIABLE D'ACCIDENT AUTOMOBILE (complété par le conducteur A, le conducteur B ayant été évacué)
Date : 19/10/2026, vers 18h50. Lieu : intersection cours de la Somme / rue de Bègles, 33800 Bordeaux. Route à double sens, priorité à droite, nuit tombante.
Blessés, même légers : OUI. Dégâts matériels à des véhicules autres que A et B : NON. Dégâts à des objets autres que des véhicules : NON.
Témoins : Mme Nadia Ferhat, 22 rue Malbec, 33800 Bordeaux, tél 06 00 00 58 91, conductrice du véhicule qui suivait la moto.

VÉHICULE A
Conducteur : M. Laurent Perrin, né le 30/01/1968, 7 impasse des Vignes, 33130 Bègles. Tél : 06 00 00 34 77.
Véhicule : Citroën C4, immatriculé DX-918-LB.
Assureur : Allianz IARD, contrat n° ALZ-44120-903.
Circonstances cochées : case 9 (s'engageait dans un carrefour), case 17 (ne respectait pas une priorité à droite).
Point de choc initial : avant gauche. Dégâts apparents : capot et pare-choc avant enfoncés, pare-brise fissuré.

VÉHICULE B (deux-roues)
Conducteur : M. Hugo Marchand, né le 11/05/2001, 48 rue Kléber, 33800 Bordeaux.
Véhicule : moto Yamaha MT-07, immatriculée GR-156-WS.
Assureur : Mutuelle des Motards, contrat n° MDM-7781-0042.
Circonstances : venait de la droite, roulait en ligne droite à vitesse réglementaire selon le témoin.
Point de choc initial : flanc droit. Dégâts apparents : fourche tordue, carénage détruit, moto non roulante.

BLESSURES ET SECOURS
Le motard a été projeté sur la chaussée. Il était conscient mais se plaignait de vives douleurs à la jambe gauche. Les pompiers et le SAMU sont intervenus sur place vers 19h05. Il a été transporté au CHU Pellegrin, où une fracture du tibia gauche a été diagnostiquée. Il devrait être opéré dans la nuit, avec une ITT probablement supérieure à 30 jours. Le conducteur A n'est pas blessé.
Un procès-verbal a été établi par la police nationale (commissariat de Bordeaux Sud).

OBSERVATIONS
A : "Je n'ai pas vu la moto arriver sur ma droite, le soleil couchant me gênait. Je me suis engagé dans le carrefour sans m'arrêter."
Témoin : "La moto roulait normalement, la voiture n'a pas marqué l'arrêt et lui a coupé la route."`,
  },
  {
    id: "fraude-suspecte",
    title: "Choc arrière déclaré tardivement, indices de fraude sans blessé",
    claimId: "CLM-2026-10612",
    expect: {
      injuries: false,
      allowedSeverities: ["URGENT_ESCALATION"],
      minVehicles: 2,
    },
    rawText: `CONSTAT AMIABLE D'ACCIDENT AUTOMOBILE
Date de l'accident : 12/10/2026, vers 23h40. Date de la déclaration à l'assureur : 21/10/2026, soit 9 jours après les faits.
Lieu : parking de la zone d'activités des Hauts-Champs, 59200 Tourcoing. Parking désert, éclairage public éteint, aucune caméra.
Blessés, même légers : NON. Dégâts matériels à des véhicules autres que A et B : NON. Dégâts à des objets autres que des véhicules : NON.
Témoins : M. Yanis Haddad, 17 rue de Lille, 59200 Tourcoing, tél 06 00 00 62 18, passager du véhicule A et frère du conducteur A.

VÉHICULE A
Conducteur : M. Samir Haddad, né le 25/07/1993, 17 rue de Lille, 59200 Tourcoing. Tél : 06 00 00 62 05.
Véhicule : Audi A3 Sportback, immatriculée GT-705-RD, achetée d'occasion le 21/09/2026, trois semaines avant l'accident.
Assureur : Matmut, contrat n° MAT-61207-344, souscrit le 21/09/2026.
Circonstances cochées : case 1 (en stationnement, à l'arrêt), rayée puis remplacée par la case 3 (roulait dans le même sens et sur la même file).
Point de choc initial déclaré : arrière. Dégâts apparents : aile avant gauche enfoncée, portières avant et arrière gauches rayées et déformées, rétroviseur gauche arraché. Le pare-choc arrière ne présente aucune trace.

VÉHICULE B
Conducteur : M. Damien Leroux, né le 03/02/1987, 9 avenue Foch, 59100 Roubaix. Tél : 06 00 00 19 76.
Véhicule : Dacia Duster, immatriculé FN-448-JA.
Assureur : GMF, contrat n° GMF-30981-552.
Circonstances cochées : case 8 (heurtait à l'arrière, en roulant dans le même sens et sur la même file).
Point de choc initial : avant. Dégâts apparents : pare-choc avant légèrement rayé, aucune déformation.

OBSERVATIONS
A : première version, "J'étais garé, moteur coupé, quand B m'a percuté par l'arrière." Version corrigée sur le même constat : "Je roulais lentement pour sortir du parking quand B m'a percuté par l'arrière."
B : "J'ai à peine touché l'arrière de la voiture A en manœuvrant, à très faible allure. Je ne comprends pas les dégâts sur le côté gauche."
Témoin (passager de A, frère du conducteur) : "Mon frère roulait doucement, la Dacia nous a foncé dedans."
Croquis : véhicule B derrière le véhicule A, choc arrière. Le constat est signé par les deux conducteurs, B a ajouté la mention "dégâts côté gauche contestés".`,
  },
];

const parseJson = (text) => JSON.parse(text);

const client = new Client({ name: "test-e2e", version: "1.0.0" });
const token = process.env.MCP_AUTH_TOKEN;
const transport = url
  ? new StreamableHTTPClientTransport(new URL(url), {
      requestInit: token ? { headers: { Authorization: `Bearer ${token}` } } : {},
    })
  : new StdioClientTransport({
      command: "node",
      args: ["dist/index.js"],
      stderr: "ignore",
    });

await client.connect(transport);
console.log(`Connecté via ${url ? `HTTP (${url})` : "stdio"}\n`);

// Appelle un tool et chronomètre l'appel. Un isError côté serveur devient une exception.
async function callTool(name, args, options) {
  const start = Date.now();
  const result = await client.callTool({ name, arguments: args }, undefined, options);
  const seconds = ((Date.now() - start) / 1000).toFixed(1);
  if (result.isError) {
    throw new Error(`${name} a renvoyé une erreur : ${result.content[0]?.text}`);
  }
  return { text: result.content[0].text, seconds };
}

async function runScenario(scenario) {
  const checks = [];
  const check = (label, ok, detail = "") => {
    checks.push(ok);
    console.log(`    ${ok ? "OK  " : "ÉCHEC"} ${label}${detail ? ` (${detail})` : ""}`);
  };

  console.log(`=== ${scenario.id} : ${scenario.title} [${scenario.claimId}]`);

  // Tool 1 : extraction du constat brut en données structurées
  const step1 = await callTool("analyze_claim_report", {
    rawText: scenario.rawText,
    claimId: scenario.claimId,
  });
  const claimData = parseJson(step1.text);
  console.log(`  1. analyze_claim_report (${step1.seconds} s)`);
  const parsedClaim = ClaimDataSchema.safeParse(claimData);
  check("sortie conforme à ClaimDataSchema", parsedClaim.success);
  check("claimId conservé", claimData.claimId === scenario.claimId, claimData.claimId);
  check(
    `au moins ${scenario.expect.minVehicles} véhicules extraits`,
    claimData.vehicles?.length >= scenario.expect.minVehicles,
    `${claimData.vehicles?.length ?? 0} trouvés`,
  );
  const hasInjuries = claimData.parties?.some((p) => p.injuries) ?? false;
  check(
    `blessé ${scenario.expect.injuries ? "détecté" : "absent"}`,
    hasInjuries === scenario.expect.injuries,
  );

  // Tool 2 : classification par Haiku, puis verdict du juge Sonnet
  const step2 = await callTool("classify_claim_severity", { claimData });
  const classification = parseJson(step2.text);
  const verdict = classification.judgeVerdict;
  console.log(`  2. classify_claim_severity (${step2.seconds} s)`);
  // severity est la décision finale du juge ; initialSeverity garde la proposition de Haiku.
  // approved: false signifie que le juge critique l'analyse, pas forcément qu'il change la décision.
  const initial = classification.initialSeverity;
  const verdictLabel = verdict?.approved
    ? "approuvé"
    : verdict?.finalSeverity === initial
      ? "désapprouvé, décision maintenue"
      : "désapprouvé, décision corrigée";
  console.log(
    `     Haiku : ${initial} (confiance ${classification.confidence})` +
      ` | juge Sonnet : ${verdict?.finalSeverity} (${verdictLabel})`,
  );
  console.log(`     Feedback du juge : ${verdict?.feedback}`);
  check("sortie conforme à ClassificationResultSchema", ClassificationResultSchema.safeParse(classification).success);
  check("proposition initiale de Haiku tracée", initial !== undefined, initial);
  check(
    `décision finale dans [${scenario.expect.allowedSeverities.join(", ")}]`,
    scenario.expect.allowedSeverities.includes(verdict?.finalSeverity),
    verdict?.finalSeverity,
  );

  // Tool 3 : notification courtier, avec suivi de progression
  const progressReceived = [];
  const step3 = await callTool(
    "generate_broker_notification",
    { claimData, classification },
    { onprogress: ({ progress }) => progressReceived.push(progress) },
  );
  console.log(`  3. generate_broker_notification (${step3.seconds} s, ${step3.text.length} caractères)`);
  check("numéro de sinistre présent dans la notification", step3.text.includes(scenario.claimId));
  // La notification 3 part juste avant la réponse : si les deux arrivent dans le même paquet,
  // le SDK client traite la réponse d'abord, supprime le handler et perd la notification.
  // Les notifications 1 et 2 partent avant l'appel à Haiku et doivent toujours arriver.
  check(
    "notifications de progression 1 et 2 reçues",
    progressReceived.includes(1) && progressReceived.includes(2),
    `${progressReceived.length} reçues sur 3`,
  );
  if (!progressReceived.includes(3)) {
    console.log("     Note : notification 3 perdue côté client (course connue du SDK MCP, le serveur l'a bien envoyée)");
  }
  console.log(`     Début : ${step3.text.slice(0, 160).replace(/\s+/g, " ")}...`);

  const passed = checks.every(Boolean);
  console.log(`  => ${passed ? "SCÉNARIO VALIDÉ" : "SCÉNARIO EN ÉCHEC"}\n`);
  return passed;
}

const selected = only ? scenarios.filter((s) => s.id === only) : scenarios;
if (selected.length === 0) {
  console.error(`Scénario inconnu : ${only}. Disponibles : ${scenarios.map((s) => s.id).join(", ")}`);
  process.exit(1);
}

const results = [];
for (const scenario of selected) {
  try {
    results.push(await runScenario(scenario));
  } catch (error) {
    console.log(`  ÉCHEC ${error.message}\n`);
    results.push(false);
  }
}

await client.close();
const passedCount = results.filter(Boolean).length;
console.log(`Bilan : ${passedCount}/${results.length} scénarios validés`);
process.exit(passedCount === results.length ? 0 : 1);
