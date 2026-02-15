declare module "canvas-confetti" {
  type ConfettiOptions = Record<string, unknown>;
  export default function confetti(options?: ConfettiOptions): Promise<null> | null;
}
