export type CliOptions = {
  input?: string;
};

export function buildArgs(options: CliOptions): string[] {
  return options.input ? ["--input", options.input] : [];
}
