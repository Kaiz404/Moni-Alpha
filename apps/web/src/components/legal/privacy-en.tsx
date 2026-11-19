import Link from 'next/link';
import { Fact, SupportEmail } from '@/components/marketing/fact';
import type { LegalDoc } from './doc';

export const PRIVACY_EN: LegalDoc = {
  title: 'Privacy policy',
  summary: (
    <>
      What Moni collects, why, where it is kept, who helps us run it, and how you can see, export or delete it. Moni
      is a budgeting app. It never moves your money and never sells your data.
    </>
  ),
  sections: [
    {
      id: 'who',
      heading: 'Who we are',
      body: (
        <>
          <p>
            Moni is run by <Fact name="legalEntity" />. In this policy, &quot;Moni&quot;, &quot;we&quot; and
            &quot;us&quot; mean <Fact name="legalEntity" />. &quot;You&quot; means the person who uses Moni.
          </p>
          <p>
            We decide how your personal data is used, so we are its data controller. This policy covers the Moni app
            for Android, the Moni web app and this website. It is written to meet Malaysia&apos;s Personal Data
            Protection Act 2010, the EU and UK General Data Protection Regulation, and US state privacy laws.
          </p>
          <p>
            This policy is in English and in Bahasa Melayu. Both say the same thing.{' '}
            <Link href="/privacy/ms" hrefLang="ms" lang="ms">
              Baca Dasar Privasi dalam Bahasa Melayu
            </Link>
            .
          </p>
        </>
      ),
    },
    {
      id: 'collect',
      heading: 'What we collect',
      body: (
        <>
          <h3>Your account</h3>
          <ul>
            <li>Your name, email address and password. Our database provider stores the password in a scrambled form that we cannot read.</li>
            <li>The month and year you were born, to check that you are 18 or older.</li>
            <li>If you sign in with Google, the name and email address Google gives us.</li>
          </ul>
          <h3>The money records you keep</h3>
          <ul>
            <li>
              Wallets and their balances, transactions, categories, tags, budgets, debts, bills, merchant names you
              set and the rules you make, such as &quot;Don&apos;t ask about similar&quot;.
            </li>
            <li>Notes and receipt photos you add to a transaction.</li>
          </ul>
          <h3>Captures</h3>
          <ul>
            <li>The text of payment alerts from the apps you link, when you allow Moni to read notifications. Section 3 explains this.</li>
            <li>Receipt photos you scan, and what you type or say to add a transaction.</li>
            <li>What Moni&apos;s AI read from each capture, and whether you approved it or marked it &quot;Not mine&quot;.</li>
          </ul>
          <h3>Location and places</h3>
          <ul>
            <li>
              Where your phone is when you add a transaction and when Moni captures a payment alert, if you allow
              location access. Moni does not ask for location access in the background and does not track where you
              go. You can turn location off for each wallet&apos;s alerts, or deny it in Android settings.
            </li>
            <li>The shop or place you pick for a transaction.</li>
          </ul>
          <h3>Settings and choices</h3>
          <ul>
            <li>Your main currency, time zone, theme and the voice you pick for Moni chat.</li>
            <li>Each time you turn Moni&apos;s AI on or off: the choice, the time and the version of the notice you saw.</li>
          </ul>
          <h3>Technical data</h3>
          <ul>
            <li>
              Your device&apos;s IP address and browser or app details reach our providers&apos; servers when you
              connect. When you sign in to the web app with a QR code, we keep a scrambled form of the browser&apos;s
              network address and a label such as &quot;Chrome on Windows&quot; until the request is used or expires.
            </li>
          </ul>
          <h3>What stays on your phone</h3>
          <ul>
            <li>Moni chat conversations and the capture log are stored on your phone, not in our database.</li>
            <li>The list of apps on your phone, which Moni shows so you can pick the apps to link.</li>
          </ul>
          <p>
            Moni never asks for your bank password or card number, and never connects to your bank account. Giving us
            your account details is needed to use Moni. Everything else is your choice.
          </p>
        </>
      ),
    },
    {
      id: 'notifications',
      heading: 'Notifications on your phone',
      body: (
        <>
          <p>
            On Android, Moni can read payment alerts so you do not have to type them in. This only starts after you
            read what it does in the app and turn on notification access in Android settings.
          </p>
          <ul>
            <li>
              Android lets Moni see every notification on your phone. Moni checks them on your phone and keeps only
              alerts from the apps you link, such as your bank or e-wallet, that look like a payment.
            </li>
            <li>One-time codes, such as a TAC or OTP, never leave your phone.</li>
            <li>
              The alerts Moni keeps go to Moni&apos;s AI, if you have turned it on, to read the payment. They are then
              saved in Moni&apos;s cloud database with your account. If the AI is off, they wait on your phone.
            </li>
          </ul>
          <p>You can turn notification access off at any time in Android settings.</p>
        </>
      ),
    },
    {
      id: 'ai',
      heading: "Moni's AI",
      body: (
        <>
          <p>
            Moni&apos;s AI turns a payment alert, a receipt photo or a sentence into a transaction, and answers your
            questions in Moni chat. Nothing goes to it until you say yes. You choose for each use: payment alerts,
            Say it, Scan a receipt and Moni chat. You can change this at any time in the Android app, in Profile › Moni&apos;s AI.
          </p>
          <p>When a use is on, Moni sends:</p>
          <ul>
            <li>Payment alerts: the text of the alert.</li>
            <li>Say it: what you type, or the words you say.</li>
            <li>Scan a receipt: the receipt photo.</li>
            <li>
              Moni chat: your message, any photo you send, and totals your phone works out from your records, such as
              spending this month. It does not send your list of transactions.
            </li>
            <li>With each capture: the names and types of your wallets and any account hint you saved for them, so the AI can pick the right one.</li>
          </ul>
          <p>
            Your words for Say it are turned into text on your phone when it can do that. Otherwise your phone&apos;s
            speech service does it.
          </p>
          <p>
            Moni&apos;s AI gateway runs on Google Cloud and stores nothing. It passes the request to OpenRouter, an AI
            service in the US, which sends it to an AI model provider. We only allow providers that do not keep the
            request and do not train on it. <Fact name="aiNoRetention" />.
          </p>
          <p>
            The AI suggests. You approve. A capture waits in Review until you approve it or mark it &quot;Not
            mine&quot;. The exception is a payment that matches what you have filed many times before, or a transfer
            between your own wallets. Moni adds those itself and marks them, and you can undo or edit them.
          </p>
          <p>
            Without the AI, you can still add transactions by hand, import a CSV file, and use budgets and debts.
            Alerts and receipts need the AI to become transactions.
          </p>
        </>
      ),
    },
    {
      id: 'why',
      heading: 'Why we use your data',
      body: (
        <>
          <p>We use your data only for these purposes:</p>
          <ul>
            <li>
              To run Moni for you: keep your records, sync them between your phone and the web, and show your budgets,
              charts and bills. The legal basis is our contract with you.
            </li>
            <li>
              To read captures with AI, read notifications and use your location. The legal basis is your consent,
              which you can withdraw at any time.
            </li>
            <li>To sign you in and keep your account safe. The legal basis is our contract with you and our legitimate interest in security.</li>
            <li>To answer you when you contact us.</li>
            <li>To meet our legal duties.</li>
          </ul>
          <p>
            We do not use your data for advertising, and we do not use it to train AI models. If we ever want to use
            your data for something new, we will tell you first and ask for your consent where the law requires it.
          </p>
        </>
      ),
    },
    {
      id: 'where',
      heading: 'Where your data is kept and who helps us',
      body: (
        <>
          <p>
            Your account and records are stored with Supabase, in <Fact name="dataRegion" />. These providers process
            data for us, only on our instructions:
          </p>
          <table>
            <thead>
              <tr>
                <th>Provider</th>
                <th>What it does</th>
                <th>Where</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Supabase</td>
                <td>Database, sign-in and receipt photo storage</td>
                <td>
                  <Fact name="dataRegion" />
                </td>
              </tr>
              <tr>
                <td>Google Cloud (Cloud Run)</td>
                <td>Runs Moni&apos;s AI gateway. It has no database and keeps nothing.</td>
                <td>Thailand</td>
              </tr>
              <tr>
                <td>OpenRouter</td>
                <td>Passes AI requests to an AI model provider</td>
                <td>United States</td>
              </tr>
              <tr>
                <td>AI model providers, through OpenRouter</td>
                <td>Read the request and send back the answer, under zero data retention</td>
                <td>Several countries</td>
              </tr>
              <tr>
                <td>Google Maps Platform</td>
                <td>Shop search and maps. Moni sends the words you search and where you are, to show places nearby.</td>
                <td>Several countries</td>
              </tr>
              <tr>
                <td>Vercel</td>
                <td>Hosts this website and the web app</td>
                <td>Singapore</td>
              </tr>
            </tbody>
          </table>
          <p>
            If you sign in with Google, Google also handles that sign-in under its own privacy policy. We do not
            share your data with anyone else, except when the law requires it.
          </p>
        </>
      ),
    },
    {
      id: 'transfers',
      heading: 'Sending data to other countries',
      body: (
        <>
          <p>
            Your data leaves your country, because the providers above work from other countries. This includes
            Thailand, the United States and the countries of the AI model providers. Some of these countries do not
            have the same data protection laws as yours.
          </p>
          <p>We protect your data when it moves:</p>
          <ul>
            <li>Each provider is bound by a data processing agreement with us. Where EU or UK law applies, these include the Standard Contractual Clauses.</li>
            <li>Data travels encrypted.</li>
            <li>We send only what each task needs.</li>
          </ul>
          <p>
            We transfer your data because it is needed to give you the service you asked for. For AI, you also agree
            to the transfer when you turn on Moni&apos;s AI.
          </p>
        </>
      ),
    },
    {
      id: 'retention',
      heading: 'How long we keep it',
      body: (
        <>
          <ul>
            <li>We keep your account and records for as long as you have a Moni account.</li>
            <li>
              When you delete something in Moni, such as a transaction or a wallet, Moni hides it everywhere. The
              record stays in our database, marked as deleted, until you delete your account.
            </li>
            <li>
              Captures you have reviewed stay in Recently reviewed for 30 days. After 90 days, the Moni app on your
              phone marks them as deleted. Like other deleted records, they stay in our database until you delete
              your account.
            </li>
            <li>A transaction made from a payment alert keeps the text of that alert.</li>
            <li>Receipt photos stay until you delete your account.</li>
            <li>Map coordinates from Google are refreshed or removed within 30 days. The place&apos;s ID stays.</li>
            <li>The AI gateway, OpenRouter and the AI model providers keep nothing after they answer.</li>
            <li>
              When you delete your account, everything goes at once. Copies in Moni&apos;s backups are gone within 7
              days.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: 'rights',
      heading: 'Your rights',
      body: (
        <>
          <p>You can:</p>
          <ul>
            <li>See your data. Most of it is in the app. For a full copy, email us.</li>
            <li>Correct it. You can edit your records in the app, or ask us.</li>
            <li>
              Get a copy you can take elsewhere. On your phone, Profile › Export data makes a CSV file of your
              wallets, categories, budgets, debts and transactions. The web app cannot export yet.
            </li>
            <li>Delete it. Section 10 explains how.</li>
            <li>
              Withdraw your consent. Turn Moni&apos;s AI off in the Android app, in Profile › Moni&apos;s AI. Turn notification access
              and location off in Android settings. Withdrawing does not undo what happened before.
            </li>
            <li>Object to or ask us to limit how we use your data.</li>
            <li>Ask us how your data has been used and who received it.</li>
          </ul>
          <p>These rights apply wherever you live, including in US states with their own privacy laws.</p>
          <p>
            To use a right, email <SupportEmail />. We will answer within the time the law sets. We may need to check
            that the request comes from you.
          </p>
          <p>
            You can also complain to a data protection authority. In Malaysia, this is the Personal Data Protection
            Department (Jabatan Perlindungan Data Peribadi, JPDP). In the EU, it is the authority in your country. In
            the UK, it is the Information Commissioner&apos;s Office (ICO). We would like the chance to fix the problem
            first, so please contact us.
          </p>
        </>
      ),
    },
    {
      id: 'delete',
      heading: 'Deleting your account',
      body: (
        <>
          <p>You can delete your account and all its data at any time:</p>
          <ul>
            <li>In the Android app: Profile › Delete your account.</li>
            <li>In the web app: Settings › Delete your account.</li>
            <li>
              Without the app: go to <Link href="/delete-account">Delete your account</Link> on this website.
            </li>
          </ul>
          <p>
            This deletes your transactions, wallets, balances, budgets, debts, rules, merchant names, captures and the
            alert text stored in our database, your receipt photos, and your sign-in on every device. It happens at
            once and cannot be undone. Copies in Moni&apos;s backups are gone within 7 days. Export a copy first if
            you want to keep your records.
          </p>
          <p>Moni chat history and the capture log are on your phone. Uninstall Moni to remove them.</p>
        </>
      ),
    },
    {
      id: 'security',
      heading: 'Security and data breaches',
      body: (
        <>
          <p>We protect your data with these measures:</p>
          <ul>
            <li>Data is encrypted when it travels and when it is stored.</li>
            <li>Each account can read only its own records. The database enforces this.</li>
            <li>The AI gateway stores nothing and does not log the content of your requests.</li>
          </ul>
          <p>
            No system is perfectly secure. If a data breach is likely to cause you significant harm, we will report
            it to the data protection authority as the law requires. In Malaysia and the EU, that is within 72 hours.
            We will also tell you without undue delay, and say what happened and what you can do.
          </p>
        </>
      ),
    },
    {
      id: 'age',
      heading: 'Age',
      body: (
        <p>
          Moni is only for people aged 18 or older. We ask for your month and year of birth when you sign up and do
          not let anyone younger create an account. If we learn that someone under 18 has an account, we will delete
          it.
        </p>
      ),
    },
    {
      id: 'selling',
      heading: 'No selling, no ads',
      body: (
        <>
          <p>
            We do not sell your personal data and we do not share it for advertising. Moni has no ads and no
            advertising or analytics trackers.
          </p>
          <p>
            The website and web app use only the cookies needed to keep you signed in. They need no consent. If we
            ever add other cookies, we will ask you first.
          </p>
        </>
      ),
    },
    {
      id: 'changes',
      heading: 'Changes to this policy',
      body: (
        <p>
          If we change this policy, we will post the new version here with its date. If a change affects how we use
          your data, we will tell you in the app or by email before it takes effect, and ask for your consent again
          where the law requires it.
        </p>
      ),
    },
    {
      id: 'contact',
      heading: 'Contact us',
      body: (
        <>
          <p>For questions about this policy or your data, contact:</p>
          <ul>
            <li>
              <Fact name="legalEntity" />
            </li>
            <li>
              Email: <SupportEmail />
            </li>
            <li>
              Post: <Fact name="postalAddress" />
            </li>
          </ul>
        </>
      ),
    },
  ],
};
