import Link from 'next/link';
import { Fact, SupportEmail } from '@/components/marketing/fact';
import type { LegalDoc } from './doc';

export const TERMS_MS: LegalDoc = {
  title: 'Terma Perkhidmatan',
  summary: (
    <>
      Peraturan untuk menggunakan Moni. Moni membantu anda menjejak wang anda. Ia bukan bank, ia tidak pernah
      memindahkan wang anda, dan ia tidak memberikan nasihat kewangan.
    </>
  ),
  sections: [
    {
      id: 'agreement',
      heading: 'Terma ini',
      body: (
        <>
          <p>
            Terma ini ialah perjanjian antara anda dengan <Fact name="legalEntity" lang="ms" />, yang mengendalikan
            Moni. Dalam terma ini, &quot;Moni&quot; dan &quot;kami&quot; bermaksud{' '}
            <Fact name="legalEntity" lang="ms" />. Terma ini meliputi aplikasi Moni untuk Android, aplikasi web Moni
            dan laman web ini.
          </p>
          <p>
            Dengan membuat akaun atau menggunakan Moni, anda bersetuju dengan terma ini.{' '}
            <Link href="/privacy/ms">Dasar Privasi</Link> kami menerangkan apa yang kami lakukan dengan data anda. Jika
            anda tidak bersetuju dengan terma ini, jangan gunakan Moni.
          </p>
          <p>
            Terma ini disediakan dalam Bahasa Melayu dan bahasa Inggeris. Kedua-duanya membawa maksud yang sama.{' '}
            <Link href="/terms" hrefLang="en" lang="en">
              Read the terms of service in English
            </Link>
            .
          </p>
        </>
      ),
    },
    {
      id: 'age',
      heading: 'Anda mesti berumur 18 tahun ke atas',
      body: (
        <p>
          Anda mesti berumur 18 tahun ke atas untuk menggunakan Moni. Kami meminta bulan dan tahun lahir anda semasa
          anda mendaftar. Jika kami mendapati seseorang di bawah umur 18 tahun mempunyai akaun, kami akan menutup akaun
          itu dan memadam datanya.
        </p>
      ),
    },
    {
      id: 'account',
      heading: 'Akaun anda',
      body: (
        <ul>
          <li>Berikan nama sebenar anda dan alamat e-mel yang boleh anda gunakan.</li>
          <li>
            Jaga keselamatan kata laluan dan telefon anda. Sesiapa yang boleh membuka Moni dalam telefon anda boleh
            melihat rekod anda dan meluluskan log masuk web.
          </li>
          <li>Satu akaun untuk satu orang. Jangan kongsi akaun anda atau gunakan akaun orang lain.</li>
          <li>Beritahu kami dengan segera jika anda fikir orang lain telah menggunakan akaun anda.</li>
        </ul>
      ),
    },
    {
      id: 'service',
      heading: 'Apa itu Moni, dan apa yang bukan',
      body: (
        <>
          <p>
            Moni ialah aplikasi belanjawan. Anda merekod dompet, transaksi, belanjawan, bil dan hutang anda, dan Moni
            menunjukkan ke mana wang anda pergi. Di Android, Moni juga boleh membaca makluman pembayaran dan resit untuk
            menambah transaksi bagi anda.
          </p>
          <p>Moni bukan bank atau perkhidmatan pembayaran:</p>
          <ul>
            <li>Moni tidak pernah memegang, menghantar atau menerima wang.</li>
            <li>Moni tidak pernah menyambung ke akaun bank anda dan tidak pernah meminta kata laluan bank anda.</li>
            <li>
              Baki dalam Moni dikira daripada apa yang anda rekod. Ia mungkin berbeza daripada baki bank anda. Rekod
              bank anda yang diguna pakai.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: 'no-advice',
      heading: 'Bukan nasihat kewangan',
      body: (
        <p>
          Moni tidak memberikan nasihat kewangan, pelaburan, cukai atau undang-undang. Belanjawan, ramalan, jumlah
          &quot;safe to spend&quot; dan jawapan dalam Moni chat ialah anggaran daripada rekod anda sendiri. Ia mungkin
          salah atau tidak terkini. Anda membuat keputusan kewangan anda sendiri. Untuk nasihat tentang keadaan anda,
          rujuk profesional yang berlesen.
        </p>
      ),
    },
    {
      id: 'ai',
      heading: 'AI Moni boleh tersilap',
      body: (
        <>
          <p>
            AI Moni membaca makluman pembayaran, resit dan apa yang anda taip atau sebut, dan menjawab soalan dalam
            Moni chat. Ia hanya berfungsi selepas anda menghidupkannya. Moni chat ialah AI, bukan manusia.
          </p>
          <ul>
            <li>
              Hasil AI boleh salah. Ia boleh tersilap membaca jumlah, tarikh, kedai atau dompet, atau terlepas sesuatu
              pembayaran.
            </li>
            <li>
              Moni menunjukkan apa yang dibaca oleh AI, dan anda meluluskannya sebelum ia menjadi transaksi.
              Pengecualiannya ialah pembayaran yang sepadan dengan apa yang telah banyak kali anda failkan sebelum ini,
              atau pindahan antara dompet anda sendiri. Moni menambahnya sendiri, menandanya, dan membolehkan anda
              membatalkan atau mengubahnya.
            </li>
            <li>Semak rekod anda. Anda bertanggungjawab atas apa yang anda luluskan dan simpan.</li>
          </ul>
          <p>Tanpa AI, anda masih boleh menambah transaksi secara manual.</p>
        </>
      ),
    },
    {
      id: 'acceptable-use',
      heading: 'Menggunakan Moni dengan wajar',
      body: (
        <>
          <p>Semasa menggunakan Moni, jangan:</p>
          <ul>
            <li>Melanggar undang-undang, atau menggunakan Moni untuk membantu orang lain melanggarnya.</li>
            <li>Merekod kewangan orang lain tanpa kebenaran mereka.</li>
            <li>Cuba memasuki akaun orang lain atau sistem kami.</li>
            <li>Mengganggu Moni, membebankannya, atau memintas had atau keselamatannya.</li>
            <li>Menyalin, menjual atau menjual semula Moni, atau menggunakan alat automatik untuk mengumpul data daripadanya.</li>
            <li>Memuat naik apa-apa yang berbahaya, seperti perisian hasad, atau kandungan yang anda tiada hak untuk gunakan.</li>
            <li>Cuba membuat AI Moni menghasilkan kandungan yang berbahaya.</li>
          </ul>
        </>
      ),
    },
    {
      id: 'your-data',
      heading: 'Data anda',
      body: (
        <>
          <p>
            Rekod anda adalah milik anda. Anda memberi kami kebenaran untuk menyimpan dan memprosesnya hanya untuk
            menjalankan Moni bagi anda, seperti yang diterangkan dalam <Link href="/privacy/ms">Dasar Privasi</Link>.
            Kami tidak menjual data anda.
          </p>
          <p>
            Anda boleh mengeksport rekod anda sebagai fail CSV daripada aplikasi Android, di Profile › Export data.
            Anda boleh memadam akaun anda dan datanya pada bila-bila masa.
          </p>
        </>
      ),
    },
    {
      id: 'price',
      heading: 'Harga',
      body: (
        <p>
          Harga Moni: <Fact name="price" lang="ms" />. Jika harga berubah, kami akan memberitahu anda sebelum perubahan
          itu terpakai kepada anda, dan anda boleh memadam akaun anda jika anda tidak mahu meneruskannya.
        </p>
      ),
    },
    {
      id: 'availability',
      heading: 'Di mana Moni boleh digunakan',
      body: (
        <>
          <p>
            Moni tersedia sebagai aplikasi Android dan aplikasi web. Tiada aplikasi iPhone. Moni ditawarkan di{' '}
            <Fact name="launchCountries" lang="ms" />.
          </p>
          <p>
            Pembacaan makluman pembayaran bergantung pada Android dan pada cara setiap bank atau e-dompet menulis
            maklumannya, jadi ia mungkin terlepas sesetengah makluman. Kami telah mengujinya dengan{' '}
            <Fact name="testedBankingApps" lang="ms" />.
          </p>
          <p>
            Kami berusaha memastikan Moni sentiasa berjalan, tetapi kami tidak dapat menjanjikan bahawa ia akan sentiasa
            tersedia atau bebas daripada ralat. Kami mungkin mengubah, menambah atau membuang ciri. Jika kami
            menghentikan Moni sepenuhnya, kami akan memberitahu anda lebih awal supaya anda boleh mengeksport rekod
            anda.
          </p>
        </>
      ),
    },
    {
      id: 'ending',
      heading: 'Menamatkan akaun anda',
      body: (
        <>
          <p>
            Anda boleh berhenti menggunakan Moni dan memadam akaun anda pada bila-bila masa, dalam aplikasi atau di
            halaman <Link href="/delete-account">Delete your account</Link>. Pemadaman membuang data anda seperti
            yang diterangkan dalam Dasar Privasi.
          </p>
          <p>
            Kami boleh menggantung atau menutup akaun anda jika anda melanggar terma ini secara serius atau berulang
            kali, atau jika dikehendaki oleh undang-undang. Jika boleh, kami akan memberitahu anda dahulu dan memberi
            anda peluang untuk mengeksport rekod anda.
          </p>
        </>
      ),
    },
    {
      id: 'liability',
      heading: 'Tanggungjawab kami kepada anda',
      body: (
        <>
          <p>
            Kami menyediakan Moni &quot;seadanya&quot;. Setakat yang dibenarkan oleh undang-undang, kami tidak
            bertanggungjawab atas:
          </p>
          <ul>
            <li>Keputusan yang anda buat berdasarkan apa yang Moni tunjukkan.</li>
            <li>Kesilapan dalam hasil AI yang anda luluskan atau tidak betulkan.</li>
            <li>Makluman yang terlepas, atau baki yang berbeza daripada baki bank anda.</li>
            <li>Kehilangan keuntungan, atau kerugian tidak langsung yang tidak dapat kami jangka.</li>
            <li>Masalah yang disebabkan oleh telefon anda, sambungan internet anda atau aplikasi lain.</li>
          </ul>
          <p>
            Tiada apa-apa dalam terma ini yang mengehadkan tanggungjawab yang tidak boleh kami hadkan di sisi
            undang-undang, atau menghapuskan hak anda sebagai pengguna di bawah undang-undang negara tempat anda
            tinggal.
          </p>
        </>
      ),
    },
    {
      id: 'law',
      heading: 'Undang-undang yang mentadbir',
      body: (
        <p>
          Terma ini ditadbir oleh <Fact name="governingLaw" lang="ms" />. Jika anda seorang pengguna, anda tetap
          dilindungi oleh undang-undang mandatori negara tempat anda tinggal, dan anda boleh membawa tuntutan di
          mahkamah negara itu.
        </p>
      ),
    },
    {
      id: 'changes',
      heading: 'Perubahan pada terma ini',
      body: (
        <p>
          Jika kami mengubah terma ini, kami akan menyiarkan versi baharu di sini bersama tarikhnya. Jika perubahan itu
          penting kepada anda, kami akan memberitahu anda dalam aplikasi atau melalui e-mel sebelum ia berkuat kuasa.
          Jika anda terus menggunakan Moni selepas itu, terma baharu terpakai. Jika anda tidak bersetuju, anda boleh
          memadam akaun anda.
        </p>
      ),
    },
    {
      id: 'contact',
      heading: 'Hubungi kami',
      body: (
        <>
          <p>Untuk soalan tentang terma ini, hubungi:</p>
          <ul>
            <li>
              <Fact name="legalEntity" lang="ms" />
            </li>
            <li>
              E-mel: <SupportEmail lang="ms" />
            </li>
            <li>
              Pos: <Fact name="postalAddress" lang="ms" />
            </li>
          </ul>
        </>
      ),
    },
  ],
};
