import { File, Paths } from 'expo-file-system';
import { shareAsync } from 'expo-sharing';

/** Hands a CSV to the Android share sheet, so the user can save it or send it anywhere. */
export async function shareCsv(fileName: string, csv: string): Promise<void> {
  const file = new File(Paths.cache, fileName);
  file.create({ overwrite: true });
  file.write(csv);
  await shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: 'Export data' });
}
