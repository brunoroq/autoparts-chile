import { cloudCommand, safeCloudFailure } from "./cloud/command";
void cloudCommand("migrate", process.argv.slice(2)).catch(safeCloudFailure);
