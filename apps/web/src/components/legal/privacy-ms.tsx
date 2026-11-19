import Link from 'next/link';
import { Fact, SupportEmail } from '@/components/marketing/fact';
import type { LegalDoc } from './doc';

export const PRIVACY_MS: LegalDoc = {
  title: 'Dasar Privasi',
  summary: (
    <>
      Data yang Moni kumpul, sebabnya, tempat ia disimpan, pihak yang membantu kami mengendalikannya, dan cara anda
      boleh melihat, mengeksport atau memadamnya. Moni ialah aplikasi belanjawan. Ia tidak pernah memindahkan wang anda
      dan tidak pernah menjual data anda.
    </>
  ),
  sections: [
    {
      id: 'who',
      heading: 'Siapa kami',
      body: (
        <>
          <p>
            Moni dikendalikan oleh <Fact name="legalEntity" lang="ms" />. Dalam dasar ini, &quot;Moni&quot; dan
            &quot;kami&quot; bermaksud <Fact name="legalEntity" lang="ms" />. &quot;Anda&quot; bermaksud orang yang
            menggunakan Moni.
          </p>
          <p>
            Kami menentukan cara data peribadi anda digunakan, jadi kami ialah pengawal datanya. Dasar ini meliputi
            aplikasi Moni untuk Android, aplikasi web Moni dan laman web ini. Ia ditulis untuk mematuhi Akta
            Perlindungan Data Peribadi 2010 Malaysia, Peraturan Perlindungan Data Am EU dan UK (GDPR), dan undang-undang
            privasi negeri di Amerika Syarikat.
          </p>
          <p>
            Dasar ini disediakan dalam Bahasa Melayu dan bahasa Inggeris. Kedua-duanya membawa maksud yang sama.{' '}
            <Link href="/privacy" hrefLang="en" lang="en">
              Read the privacy policy in English
            </Link>
            .
          </p>
        </>
      ),
    },
    {
      id: 'collect',
      heading: 'Data yang kami kumpul',
      body: (
        <>
          <h3>Akaun anda</h3>
          <ul>
            <li>
              Nama, alamat e-mel dan kata laluan anda. Penyedia pangkalan data kami menyimpan kata laluan dalam bentuk
              cincangan yang tidak boleh kami baca.
            </li>
            <li>Bulan dan tahun lahir anda, untuk memastikan anda berumur 18 tahun ke atas.</li>
            <li>Jika anda log masuk dengan Google, nama dan alamat e-mel yang Google berikan kepada kami.</li>
          </ul>
          <h3>Rekod wang yang anda simpan</h3>
          <ul>
            <li>
              Dompet dan bakinya, transaksi, kategori, tag, belanjawan, hutang, bil, nama peniaga yang anda tetapkan
              dan peraturan yang anda buat, seperti &quot;Don&apos;t ask about similar&quot;.
            </li>
            <li>Nota dan foto resit yang anda tambah pada transaksi.</li>
          </ul>
          <h3>Tangkapan</h3>
          <ul>
            <li>
              Teks makluman pembayaran daripada aplikasi yang anda pautkan, jika anda membenarkan Moni membaca
              pemberitahuan. Seksyen 3 menerangkannya.
            </li>
            <li>Foto resit yang anda imbas, dan apa yang anda taip atau sebut untuk menambah transaksi.</li>
            <li>
              Apa yang dibaca oleh AI Moni daripada setiap tangkapan, dan sama ada anda meluluskannya atau menandanya
              &quot;Not mine&quot;.
            </li>
          </ul>
          <h3>Lokasi dan tempat</h3>
          <ul>
            <li>
              Lokasi telefon anda semasa anda menambah transaksi dan semasa Moni menangkap makluman pembayaran, jika
              anda membenarkan akses lokasi. Moni tidak meminta akses lokasi di latar belakang dan tidak menjejak ke
              mana anda pergi. Anda boleh mematikan lokasi bagi makluman setiap dompet, atau menolaknya dalam tetapan
              Android.
            </li>
            <li>Kedai atau tempat yang anda pilih untuk sesuatu transaksi.</li>
          </ul>
          <h3>Tetapan dan pilihan</h3>
          <ul>
            <li>Mata wang utama, zon waktu, tema dan gaya suara yang anda pilih untuk Moni chat.</li>
            <li>
              Setiap kali anda menghidupkan atau mematikan AI Moni: pilihan itu, masanya dan versi notis yang anda
              lihat.
            </li>
          </ul>
          <h3>Data teknikal</h3>
          <ul>
            <li>
              Alamat IP peranti anda dan butiran pelayar atau aplikasi sampai ke pelayan penyedia kami apabila anda
              bersambung. Apabila anda log masuk ke aplikasi web dengan kod QR, kami menyimpan alamat rangkaian pelayar
              dalam bentuk cincangan dan label seperti &quot;Chrome on Windows&quot; sehingga permintaan itu
              digunakan atau tamat tempoh.
            </li>
          </ul>
          <h3>Data yang kekal dalam telefon anda</h3>
          <ul>
            <li>Perbualan Moni chat dan log tangkapan disimpan dalam telefon anda, bukan dalam pangkalan data kami.</li>
            <li>Senarai aplikasi dalam telefon anda, yang Moni tunjukkan supaya anda boleh memilih aplikasi untuk dipautkan.</li>
          </ul>
          <p>
            Moni tidak pernah meminta kata laluan bank atau nombor kad anda, dan tidak pernah menyambung ke akaun bank
            anda. Butiran akaun anda diperlukan untuk menggunakan Moni. Data lain diberikan secara sukarela.
          </p>
        </>
      ),
    },
    {
      id: 'notifications',
      heading: 'Pemberitahuan dalam telefon anda',
      body: (
        <>
          <p>
            Di Android, Moni boleh membaca makluman pembayaran supaya anda tidak perlu menaipnya. Ini hanya bermula
            selepas anda membaca penerangannya dalam aplikasi dan menghidupkan akses pemberitahuan dalam tetapan
            Android.
          </p>
          <ul>
            <li>
              Android membenarkan Moni melihat setiap pemberitahuan dalam telefon anda. Moni menyemaknya dalam telefon
              anda dan hanya menyimpan makluman daripada aplikasi yang anda pautkan, seperti bank atau e-dompet anda,
              yang kelihatan seperti pembayaran.
            </li>
            <li>Kod sekali guna, seperti TAC atau OTP, tidak pernah keluar dari telefon anda.</li>
            <li>
              Makluman yang Moni simpan dihantar kepada AI Moni, jika anda telah menghidupkannya, untuk membaca
              pembayaran itu. Kemudian ia disimpan dalam pangkalan data awan Moni bersama akaun anda. Jika AI
              dimatikan, makluman itu menunggu dalam telefon anda.
            </li>
          </ul>
          <p>Anda boleh mematikan akses pemberitahuan pada bila-bila masa dalam tetapan Android.</p>
        </>
      ),
    },
    {
      id: 'ai',
      heading: 'AI Moni',
      body: (
        <>
          <p>
            AI Moni menukar makluman pembayaran, foto resit atau ayat kepada transaksi, dan menjawab soalan anda dalam
            Moni chat. Tiada apa-apa dihantar kepadanya sehingga anda bersetuju. Anda memilih bagi setiap kegunaan:
            makluman pembayaran, Say it, Scan a receipt dan Moni chat. Anda boleh mengubahnya pada bila-bila masa
            dalam aplikasi Android, di Profile › Moni&apos;s AI.
          </p>
          <p>Apabila sesuatu kegunaan dihidupkan, Moni menghantar:</p>
          <ul>
            <li>Makluman pembayaran: teks makluman itu.</li>
            <li>Say it: apa yang anda taip, atau perkataan yang anda sebut.</li>
            <li>Scan a receipt: foto resit itu.</li>
            <li>
              Moni chat: mesej anda, sebarang foto yang anda hantar, dan jumlah yang dikira oleh telefon anda daripada
              rekod anda, seperti perbelanjaan bulan ini. Ia tidak menghantar senarai transaksi anda.
            </li>
            <li>
              Bersama setiap tangkapan: nama dan jenis dompet anda serta sebarang petunjuk akaun yang anda simpan
              untuknya, supaya AI dapat memilih dompet yang betul.
            </li>
          </ul>
          <p>
            Perkataan yang anda sebut untuk Say it ditukar kepada teks dalam telefon anda jika telefon itu boleh
            melakukannya. Jika tidak, perkhidmatan pertuturan telefon anda yang melakukannya.
          </p>
          <p>
            Get laluan AI Moni berjalan di Google Cloud dan tidak menyimpan apa-apa. Ia menghantar permintaan kepada
            OpenRouter, perkhidmatan AI di Amerika Syarikat, yang menghantarnya pula kepada penyedia model AI. Kami
            hanya membenarkan penyedia yang tidak menyimpan permintaan itu dan tidak melatih model dengannya.{' '}
            <Fact name="aiNoRetention" lang="ms" />.
          </p>
          <p>
            AI mencadangkan. Anda yang meluluskan. Setiap tangkapan menunggu dalam Review sehingga anda meluluskannya
            atau menandanya &quot;Not mine&quot;. Pengecualiannya ialah pembayaran yang sepadan dengan apa yang telah
            banyak kali anda failkan sebelum ini, atau pindahan antara dompet anda sendiri. Moni menambahnya sendiri
            dan menandanya, dan anda boleh membatalkan atau mengubahnya.
          </p>
          <p>
            Tanpa AI, anda masih boleh menambah transaksi secara manual, mengimport fail CSV, dan menggunakan belanjawan
            serta hutang. Makluman dan resit memerlukan AI untuk menjadi transaksi.
          </p>
        </>
      ),
    },
    {
      id: 'why',
      heading: 'Sebab kami menggunakan data anda',
      body: (
        <>
          <p>Kami menggunakan data anda hanya untuk tujuan berikut:</p>
          <ul>
            <li>
              Untuk menjalankan Moni bagi anda: menyimpan rekod anda, menyegerakkannya antara telefon dan web, dan
              menunjukkan belanjawan, carta dan bil anda. Asas undang-undangnya ialah kontrak kami dengan anda.
            </li>
            <li>
              Untuk membaca tangkapan dengan AI, membaca pemberitahuan dan menggunakan lokasi anda. Asas
              undang-undangnya ialah persetujuan anda, yang boleh anda tarik balik pada bila-bila masa.
            </li>
            <li>
              Untuk log masuk anda dan memastikan akaun anda selamat. Asas undang-undangnya ialah kontrak kami dengan
              anda dan kepentingan sah kami dalam keselamatan.
            </li>
            <li>Untuk menjawab anda apabila anda menghubungi kami.</li>
            <li>Untuk memenuhi kewajipan undang-undang kami.</li>
          </ul>
          <p>
            Kami tidak menggunakan data anda untuk pengiklanan, dan tidak menggunakannya untuk melatih model AI. Jika
            kami ingin menggunakan data anda untuk tujuan baharu, kami akan memberitahu anda dahulu dan meminta
            persetujuan anda jika undang-undang memerlukannya.
          </p>
        </>
      ),
    },
    {
      id: 'where',
      heading: 'Tempat data anda disimpan dan pihak yang membantu kami',
      body: (
        <>
          <p>
            Akaun dan rekod anda disimpan dengan Supabase, di <Fact name="dataRegion" lang="ms" />. Pemproses data
            berikut memproses data bagi pihak kami, hanya mengikut arahan kami:
          </p>
          <table>
            <thead>
              <tr>
                <th>Pemproses</th>
                <th>Peranannya</th>
                <th>Lokasi</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Supabase</td>
                <td>Pangkalan data, log masuk dan simpanan foto resit</td>
                <td>
                  <Fact name="dataRegion" lang="ms" />
                </td>
              </tr>
              <tr>
                <td>Google Cloud (Cloud Run)</td>
                <td>Menjalankan get laluan AI Moni. Ia tiada pangkalan data dan tidak menyimpan apa-apa.</td>
                <td>Thailand</td>
              </tr>
              <tr>
                <td>OpenRouter</td>
                <td>Menghantar permintaan AI kepada penyedia model AI</td>
                <td>Amerika Syarikat</td>
              </tr>
              <tr>
                <td>Penyedia model AI, melalui OpenRouter</td>
                <td>Membaca permintaan dan menghantar jawapan, tanpa menyimpan data</td>
                <td>Beberapa negara</td>
              </tr>
              <tr>
                <td>Google Maps Platform</td>
                <td>
                  Carian kedai dan peta. Moni menghantar perkataan yang anda cari dan lokasi anda, untuk menunjukkan
                  tempat berdekatan.
                </td>
                <td>Beberapa negara</td>
              </tr>
              <tr>
                <td>Vercel</td>
                <td>Mengehos laman web ini dan aplikasi web</td>
                <td>Singapura</td>
              </tr>
            </tbody>
          </table>
          <p>
            Jika anda log masuk dengan Google, Google juga mengendalikan log masuk itu di bawah dasar privasinya
            sendiri. Kami tidak berkongsi data anda dengan pihak lain, kecuali jika dikehendaki oleh undang-undang.
          </p>
        </>
      ),
    },
    {
      id: 'transfers',
      heading: 'Pemindahan data ke negara lain',
      body: (
        <>
          <p>
            Data anda dipindahkan keluar dari negara anda, kerana pemproses di atas beroperasi dari negara lain. Ini
            termasuk Thailand, Amerika Syarikat dan negara penyedia model AI. Sesetengah negara ini tidak mempunyai
            undang-undang perlindungan data yang sama dengan negara anda.
          </p>
          <p>Kami melindungi data anda semasa ia dipindahkan:</p>
          <ul>
            <li>
              Setiap pemproses terikat dengan perjanjian pemprosesan data dengan kami. Jika undang-undang EU atau UK
              terpakai, perjanjian ini termasuk Klausa Kontrak Standard (Standard Contractual Clauses).
            </li>
            <li>Data dihantar dalam bentuk yang disulitkan.</li>
            <li>Kami hanya menghantar apa yang diperlukan bagi setiap tugas.</li>
          </ul>
          <p>
            Kami memindahkan data anda kerana ia perlu untuk memberikan perkhidmatan yang anda minta. Bagi AI, anda
            juga bersetuju dengan pemindahan itu apabila anda menghidupkan AI Moni.
          </p>
        </>
      ),
    },
    {
      id: 'retention',
      heading: 'Tempoh kami menyimpan data',
      body: (
        <ul>
          <li>Kami menyimpan akaun dan rekod anda selagi anda mempunyai akaun Moni.</li>
          <li>
            Apabila anda memadam sesuatu dalam Moni, seperti transaksi atau dompet, Moni menyembunyikannya di semua
            tempat. Rekod itu kekal dalam pangkalan data kami, ditanda sebagai dipadam, sehingga anda memadam akaun
            anda.
          </li>
          <li>
            Tangkapan yang telah anda semak kekal dalam Recently reviewed selama 30 hari. Selepas 90 hari, aplikasi Moni
            dalam telefon anda menandanya sebagai dipadam. Seperti rekod lain yang dipadam, ia kekal dalam pangkalan
            data kami sehingga anda memadam akaun anda.
          </li>
          <li>Transaksi yang dibuat daripada makluman pembayaran menyimpan teks makluman itu.</li>
          <li>Foto resit disimpan sehingga anda memadam akaun anda.</li>
          <li>Koordinat peta daripada Google dikemas kini atau dibuang dalam masa 30 hari. ID tempat itu kekal.</li>
          <li>Get laluan AI, OpenRouter dan penyedia model AI tidak menyimpan apa-apa selepas menjawab.</li>
          <li>
            Apabila anda memadam akaun anda, semuanya dipadam serta-merta. Salinan dalam sandaran Moni hilang dalam
            masa 7 hari.
          </li>
        </ul>
      ),
    },
    {
      id: 'rights',
      heading: 'Hak anda',
      body: (
        <>
          <p>Anda boleh:</p>
          <ul>
            <li>Melihat data anda. Kebanyakannya ada dalam aplikasi. Untuk salinan penuh, hantar e-mel kepada kami.</li>
            <li>Membetulkannya. Anda boleh menyunting rekod anda dalam aplikasi, atau meminta kami.</li>
            <li>
              Mendapatkan salinan untuk dibawa ke tempat lain. Profile › Export data dalam telefon anda, atau Settings ›
              Import and export di web, membuat fail CSV yang mengandungi dompet, kategori, belanjawan, hutang dan
              transaksi anda.
            </li>
            <li>Memadamnya. Seksyen 10 menerangkan caranya.</li>
            <li>
              Menarik balik persetujuan anda. Matikan AI Moni dalam aplikasi Android, di Profile › Moni&apos;s AI.
              Matikan akses pemberitahuan dan lokasi dalam tetapan Android. Penarikan balik tidak membatalkan apa yang
              berlaku sebelumnya.
            </li>
            <li>Membantah, atau meminta kami mengehadkan, cara kami menggunakan data anda.</li>
            <li>Bertanya kepada kami cara data anda telah digunakan dan siapa yang menerimanya.</li>
          </ul>
          <p>Hak ini terpakai di mana-mana sahaja anda tinggal, termasuk di negeri Amerika Syarikat yang mempunyai undang-undang privasi sendiri.</p>
          <p>
            Untuk menggunakan hak ini, hantar e-mel ke <SupportEmail lang="ms" />. Kami akan menjawab dalam tempoh yang
            ditetapkan oleh undang-undang. Kami mungkin perlu mengesahkan bahawa permintaan itu datang daripada anda.
          </p>
          <p>
            Anda juga boleh membuat aduan kepada pihak berkuasa perlindungan data. Di Malaysia, pihak itu ialah Jabatan
            Perlindungan Data Peribadi (JPDP). Di EU, pihak itu ialah pihak berkuasa di negara anda. Di UK, pihak itu
            ialah Information Commissioner&apos;s Office (ICO). Kami berharap dapat membetulkan masalah itu dahulu,
            jadi sila hubungi kami.
          </p>
        </>
      ),
    },
    {
      id: 'delete',
      heading: 'Memadam akaun anda',
      body: (
        <>
          <p>Anda boleh memadam akaun anda dan semua datanya pada bila-bila masa:</p>
          <ul>
            <li>Dalam aplikasi Android: Profile › Delete your account.</li>
            <li>Dalam aplikasi web: Settings › Delete your account.</li>
            <li>
              Tanpa aplikasi: pergi ke halaman <Link href="/delete-account">Delete your account</Link> di laman web
              ini.
            </li>
          </ul>
          <p>
            Ini memadam transaksi, dompet, baki, belanjawan, hutang, peraturan, nama peniaga, tangkapan dan teks
            makluman yang disimpan dalam pangkalan data kami, foto resit anda, dan log masuk anda pada setiap peranti.
            Ia berlaku serta-merta dan tidak boleh dibatalkan. Salinan dalam sandaran Moni hilang dalam masa 7 hari.
            Eksport salinan dahulu jika anda mahu menyimpan rekod anda.
          </p>
          <p>
            Sejarah Moni chat dan log tangkapan berada dalam telefon anda. Nyahpasang Moni untuk membuangnya.
          </p>
        </>
      ),
    },
    {
      id: 'security',
      heading: 'Keselamatan dan pelanggaran data',
      body: (
        <>
          <p>Kami melindungi data anda dengan langkah berikut:</p>
          <ul>
            <li>Data disulitkan semasa dihantar dan semasa disimpan.</li>
            <li>Setiap akaun hanya boleh membaca rekodnya sendiri. Pangkalan data menguatkuasakannya.</li>
            <li>Get laluan AI tidak menyimpan apa-apa dan tidak merekodkan kandungan permintaan anda.</li>
          </ul>
          <p>
            Tiada sistem yang selamat sepenuhnya. Jika pelanggaran data mungkin menyebabkan kemudaratan yang ketara
            kepada anda, kami akan melaporkannya kepada pihak berkuasa perlindungan data seperti yang dikehendaki oleh
            undang-undang. Di Malaysia dan EU, laporan itu dibuat dalam masa 72 jam. Kami juga akan memberitahu anda
            tanpa kelewatan yang tidak wajar, serta menerangkan apa yang berlaku dan apa yang boleh anda lakukan.
          </p>
        </>
      ),
    },
    {
      id: 'age',
      heading: 'Umur',
      body: (
        <p>
          Moni hanya untuk orang yang berumur 18 tahun ke atas. Kami meminta bulan dan tahun lahir anda semasa anda
          mendaftar dan tidak membenarkan sesiapa yang lebih muda membuat akaun. Jika kami mendapati seseorang di bawah
          umur 18 tahun mempunyai akaun, kami akan memadamnya.
        </p>
      ),
    },
    {
      id: 'selling',
      heading: 'Tiada jualan data, tiada iklan',
      body: (
        <>
          <p>
            Kami tidak menjual data peribadi anda dan tidak berkongsinya untuk pengiklanan. Moni tiada iklan dan tiada
            penjejak pengiklanan atau analitik.
          </p>
          <p>
            Laman web dan aplikasi web hanya menggunakan kuki yang diperlukan untuk memastikan anda kekal log masuk.
            Kuki ini tidak memerlukan persetujuan. Jika kami menambah kuki lain, kami akan meminta persetujuan anda
            dahulu.
          </p>
        </>
      ),
    },
    {
      id: 'changes',
      heading: 'Perubahan pada dasar ini',
      body: (
        <p>
          Jika kami mengubah dasar ini, kami akan menyiarkan versi baharu di sini bersama tarikhnya. Jika perubahan
          itu menjejaskan cara kami menggunakan data anda, kami akan memberitahu anda dalam aplikasi atau melalui e-mel
          sebelum ia berkuat kuasa, dan meminta persetujuan anda sekali lagi jika undang-undang memerlukannya.
        </p>
      ),
    },
    {
      id: 'contact',
      heading: 'Hubungi kami',
      body: (
        <>
          <p>Untuk soalan tentang dasar ini atau data anda, hubungi:</p>
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
