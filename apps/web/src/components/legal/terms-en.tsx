import Link from 'next/link';
import { Fact, SupportEmail } from '@/components/marketing/fact';
import type { LegalDoc } from './doc';

export const TERMS_EN: LegalDoc = {
  title: 'Terms of service',
  summary: (
    <>
      The rules for using Moni. Moni helps you keep track of your money. It is not a bank, it never moves your money,
      and it does not give financial advice.
    </>
  ),
  sections: [
    {
      id: 'agreement',
      heading: 'These terms',
      body: (
        <>
          <p>
            These terms are an agreement between you and <Fact name="legalEntity" />, which runs Moni. In these terms,
            &quot;Moni&quot;, &quot;we&quot; and &quot;us&quot; mean <Fact name="legalEntity" />. They cover the Moni
            app for Android, the Moni web app and this website.
          </p>
          <p>
            By creating an account or using Moni, you agree to these terms. Our <Link href="/privacy">privacy
            policy</Link> explains what we do with your data. If you do not agree to these terms, do not use Moni.
          </p>
          <p>
            These terms are in English and in Bahasa Melayu. Both say the same thing.{' '}
            <Link href="/terms/ms" hrefLang="ms" lang="ms">
              Baca Terma Perkhidmatan dalam Bahasa Melayu
            </Link>
            .
          </p>
        </>
      ),
    },
    {
      id: 'age',
      heading: 'You must be 18 or older',
      body: (
        <p>
          You must be 18 or older to use Moni. We ask for your month and year of birth when you sign up. If we learn
          that someone under 18 has an account, we will close it and delete its data.
        </p>
      ),
    },
    {
      id: 'account',
      heading: 'Your account',
      body: (
        <ul>
          <li>Give us your real name and an email address you can use.</li>
          <li>Keep your password and your phone safe. Anyone who can open Moni on your phone can see your records and approve a web sign-in.</li>
          <li>An account is for one person. Do not share it or use someone else&apos;s.</li>
          <li>Tell us at once if you think someone else has used your account.</li>
        </ul>
      ),
    },
    {
      id: 'service',
      heading: 'What Moni is, and what it is not',
      body: (
        <>
          <p>
            Moni is a budgeting app. You record your wallets, transactions, budgets, bills and debts, and Moni shows
            you where your money goes. On Android, Moni can also read payment alerts and receipts to add transactions
            for you.
          </p>
          <p>Moni is not a bank or a payment service:</p>
          <ul>
            <li>Moni never holds, sends or receives money.</li>
            <li>Moni never connects to your bank account and never asks for your bank password.</li>
            <li>
              The balances in Moni are worked out from what you record. They can differ from your bank&apos;s. Your
              bank&apos;s records are the ones that count.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: 'no-advice',
      heading: 'No financial advice',
      body: (
        <p>
          Moni does not give financial, investment, tax or legal advice. Budgets, forecasts, &quot;safe to
          spend&quot; amounts and answers in Moni chat are estimates from your own records. They can be wrong or out
          of date. You make your own money decisions. For advice about your situation, ask a licensed professional.
        </p>
      ),
    },
    {
      id: 'ai',
      heading: "Moni's AI can be wrong",
      body: (
        <>
          <p>
            Moni&apos;s AI reads payment alerts, receipts and what you type or say, and answers questions in Moni chat.
            It works only after you turn it on. Moni chat is an AI, not a person.
          </p>
          <ul>
            <li>
              AI output can be wrong. It can misread an amount, a date, a shop or a wallet, or miss a payment.
            </li>
            <li>
              Moni shows you what the AI read, and you approve it before it becomes a transaction. The exception is a
              payment that matches what you have filed many times before, or a transfer between your own wallets.
              Moni adds those itself, marks them, and lets you undo or edit them.
            </li>
            <li>Check your records. You are responsible for what you approve and keep.</li>
          </ul>
          <p>Without the AI, you can still add transactions by hand.</p>
        </>
      ),
    },
    {
      id: 'acceptable-use',
      heading: 'Using Moni fairly',
      body: (
        <>
          <p>When you use Moni, do not:</p>
          <ul>
            <li>Break the law, or use Moni to help anyone else break it.</li>
            <li>Record someone else&apos;s finances without their permission.</li>
            <li>Try to get into another person&apos;s account or into our systems.</li>
            <li>Disrupt Moni, overload it, or get around its limits or security.</li>
            <li>Copy, sell or resell Moni, or use automated tools to collect data from it.</li>
            <li>Upload anything harmful, such as malware, or content you have no right to use.</li>
            <li>Try to make Moni&apos;s AI produce harmful content.</li>
          </ul>
        </>
      ),
    },
    {
      id: 'your-data',
      heading: 'Your data',
      body: (
        <>
          <p>
            Your records belong to you. You give us permission to store and process them only to run Moni for you, as
            the <Link href="/privacy">privacy policy</Link> explains. We do not sell your data.
          </p>
          <p>
            You can export your records as a CSV file from the Android app, in Profile › Export data. You can delete
            your account and its data at any time.
          </p>
        </>
      ),
    },
    {
      id: 'price',
      heading: 'Price',
      body: (
        <p>
          Moni&apos;s price: <Fact name="price" />. If the price changes, we will tell you before the change applies
          to you, and you can delete your account if you do not want to continue.
        </p>
      ),
    },
    {
      id: 'availability',
      heading: 'Where Moni works',
      body: (
        <>
          <p>
            Moni is available as an Android app and as a web app. There is no iPhone app. Moni is offered in{' '}
            <Fact name="launchCountries" />.
          </p>
          <p>
            Reading payment alerts depends on Android and on how each bank or e-wallet writes its alerts, so it may
            miss some. We have tested it with <Fact name="testedBankingApps" />.
          </p>
          <p>
            We work to keep Moni running, but we cannot promise it will always be available or free of errors. We may
            change, add or remove features. If we stop Moni completely, we will tell you in advance so you can export
            your records.
          </p>
        </>
      ),
    },
    {
      id: 'ending',
      heading: 'Ending your account',
      body: (
        <>
          <p>
            You can stop using Moni and delete your account at any time, in the app or on the{' '}
            <Link href="/delete-account">Delete your account</Link> page. Deleting removes your data as the privacy
            policy describes.
          </p>
          <p>
            We may suspend or close your account if you seriously or repeatedly break these terms, or if the law
            requires it. Where we can, we will tell you first and give you the chance to export your records.
          </p>
        </>
      ),
    },
    {
      id: 'liability',
      heading: 'Our responsibility to you',
      body: (
        <>
          <p>
            We provide Moni &quot;as is&quot;. As far as the law allows, we are not responsible for:
          </p>
          <ul>
            <li>Decisions you make based on what Moni shows you.</li>
            <li>Mistakes in AI output that you approved or did not correct.</li>
            <li>Missed alerts, or balances that differ from your bank&apos;s.</li>
            <li>Loss of profit, or indirect losses we could not have foreseen.</li>
            <li>Problems caused by your phone, your internet connection or other apps.</li>
          </ul>
          <p>
            Nothing in these terms limits a responsibility that the law does not allow us to limit, or takes away your
            rights as a consumer under the law of the country where you live.
          </p>
        </>
      ),
    },
    {
      id: 'law',
      heading: 'Governing law',
      body: (
        <p>
          These terms are governed by <Fact name="governingLaw" />. If you are a consumer, you keep the protection of
          the mandatory laws of the country where you live, and you can bring a claim in its courts.
        </p>
      ),
    },
    {
      id: 'changes',
      heading: 'Changes to these terms',
      body: (
        <p>
          If we change these terms, we will post the new version here with its date. If a change matters to you, we
          will tell you in the app or by email before it takes effect. If you keep using Moni after that, the new
          terms apply. If you do not agree, you can delete your account.
        </p>
      ),
    },
    {
      id: 'contact',
      heading: 'Contact us',
      body: (
        <>
          <p>For questions about these terms, contact:</p>
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
