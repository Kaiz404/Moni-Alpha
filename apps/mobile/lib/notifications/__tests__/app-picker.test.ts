import { appPickerRows } from '../app-picker';

const app = (packageName: string, label: string, iconUri: string | null = null) => ({
  packageName,
  label,
  iconUri,
});

const names = (rows: ReturnType<typeof appPickerRows>) => rows.map((row) => row.label);

describe('the app picker rows', () => {
  it('lists known finance apps first, then everything else by name, hiding nothing', () => {
    const rows = appPickerRows(
      [
        app('com.whatsapp', 'WhatsApp'),
        app('com.example.anybank', 'anybank'),
        app('com.cimb.cimbocto', 'OCTO'),
        app('my.com.gxbank.app', 'GXBank'),
        app('com.bank.zeta', 'Zeta Bank'),
      ],
      null,
    );

    expect(names(rows)).toEqual(['GXBank', 'OCTO', 'anybank', 'WhatsApp', 'Zeta Bank']);
    expect(rows.map((row) => row.suggested)).toEqual([true, true, false, false, false]);
  });

  it('leaves Moni out, in both of its builds', () => {
    const rows = appPickerRows(
      [
        app('com.anonymous.moni', 'Moni'),
        app('com.anonymous.moni.e2e', 'Moni E2E'),
        app('com.example.anybank', 'Any Bank'),
      ],
      null,
    );

    expect(names(rows)).toEqual(['Any Bank']);
  });

  it('keeps a linked app the phone no longer lists, so the sheet can show what is picked', () => {
    const rows = appPickerRows(
      [app('com.whatsapp', 'WhatsApp')],
      app('com.example.gone', 'Gone Bank', 'data:image/png;base64,AAAA'),
    );

    expect(rows).toEqual([
      {
        packageName: 'com.example.gone',
        label: 'Gone Bank',
        iconUri: 'data:image/png;base64,AAAA',
        suggested: false,
        missing: true,
      },
      { packageName: 'com.whatsapp', label: 'WhatsApp', iconUri: null, suggested: false, missing: false },
    ]);
  });

  it('adds no second row when the link holds a legacy id of a listed app', () => {
    const rows = appPickerRows(
      [app('my.com.tngdigital.ewallet', "Touch 'n Go eWallet")],
      app('com.tngdigital.ewallet', 'TNG', null),
    );

    expect(names(rows)).toEqual(["Touch 'n Go eWallet"]);
  });

  it('is empty when the phone lists nothing and nothing is linked', () => {
    expect(appPickerRows([], null)).toEqual([]);
  });
});
