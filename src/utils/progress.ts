export type SendProgressFn = (
  progress: number,
  total: number,
  message?: string
) => Promise<void>;

export async function sendProgress(
  sendFn: SendProgressFn,
  progress: number,
  total: number,
  message?: string
): Promise<void> {
  await sendFn(progress, total, message);
}