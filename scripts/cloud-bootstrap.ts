import { cloudCommand, safeCloudFailure } from "./cloud/command";
void cloudCommand("bootstrap", process.argv.slice(2)).catch(safeCloudFailure);
