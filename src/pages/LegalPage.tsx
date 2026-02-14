import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

interface LegalContent {
    title: string;
    content: string;
}

const legalPages: Record<string, LegalContent> = {
    'gizlilik-politikasi': {
        title: 'Gizlilik Politikası',
        content: `
            <h2>GİZLİLİK VE GÜVENLİK POLİTİKASI</h2>
            <p>İçel Solar Market olarak, kullanıcılarımızın hizmetlerimizden güvenli ve eksiksiz şekilde faydalanmalarını sağlamak amacıyla gizliliğinizi korumaya önem veriyoruz.</p>

            <h3>1. Kredi Kartı Güvenliği</h3>
            <p>Firmamız, alışveriş sitelerimizden alışveriş yapan kredi kartı sahiplerinin güvenliğini ilk planda tutmaktadır. Kredi kartı bilgileriniz hiçbir şekilde sistemimizde saklanmamaktadır. Ödeme sırasında kullanılan bilgiler 256 bit SSL (Secure Sockets Layer) protokolü ile şifrelenip sorgulanmak üzere ilgili bankaya ulaştırılır.</p>

            <h3>2. Üçüncü Taraf Web Siteleri ve Uygulamalar</h3>
            <p>Mağazamız, web sitesi dâhilinde başka sitelere link verebilir. Firmamız, bu linkler vasıtasıyla erişilen sitelerin gizlilik uygulamaları ve içeriklerine yönelik herhangi bir sorumluluk taşımamaktadır.</p>

            <h3>3. Çerez (Cookie) Kullanımı</h3>
            <p>Sitemiz, kullanıcı deneyimini iyileştirmek, sepetinizi hatırlamak ve site performansını analiz etmek amacıyla çerezler kullanmaktadır. Tarayıcı ayarlarınızdan çerezleri dilediğiniz zaman engelleyebilirsiniz ancak bu durumda sitenin bazı fonksiyonları (örn. sepet işlemleri) çalışmayabilir.</p>

            <h3>4. E-Posta Güvenliği</h3>
            <p>Müşteri Hizmetleri’ne göndereceğiniz e-postalarda asla kredi kartı numaranızı veya şifrelerinizi yazmayınız. E-postalarda yer alan bilgilerin güvenliği garanti edilemez.</p>
        `
    },
    'kullanim-kosullari': {
        title: 'Kullanım Koşulları',
        content: `
            <h2>KULLANIM KOŞULLARI VE ÜYELİK SÖZLEŞMESİ</h2>
            <p>Bu internet sitesine girmeniz veya bu internet sitesindeki herhangi bir bilgiyi kullanmanız aşağıdaki koşulları kabul ettiğiniz anlamına gelir.</p>

            <h3>1. Taraflar</h3>
            <p>İşbu sözleşme, icelsolarmarket.com sitesinin sahibi İçel Solar Market ile siteye üye olan/ziyaret eden internet kullanıcısı ("Kullanıcı") arasında akdedilmiştir.</p>

            <h3>2. Fikri Mülkiyet Hakları</h3>
            <p>İşbu sitede yer alan unvan, işletme adı, marka, patent, logo, tasarım, bilgi ve yöntem gibi tescilli veya tescilsiz tüm fikri mülkiyet hakları site işleteni ve sahibi firmaya veya belirtilen ilgilisine ait olup, ulusal ve uluslararası hukukun koruması altındadır. İzinsiz kopyalanamaz.</p>

            <h3>3. Sorumluluklar</h3>
            <ul>
                <li>Kullanıcı, siteyi kullanırken yasalara uygun davranacağını, haksız rekabet yaratacak veya başkalarının haklarına tecavüz edecek eylemlerde bulunmayacağını kabul eder.</li>
                <li>Site üzerinden verilen siparişlerde, kullanıcının beyan ettiği teslimat ve iletişim bilgilerinin doğruluğu kullanıcının sorumluluğundadır.</li>
            </ul>

            <h3>4. Değişiklik Hakkı</h3>
            <p>İçel Solar Market, işbu site ve site uzantısında mevcut her tür hizmet, ürün, kullanma koşulları ile sitede sunulan bilgileri önceden bir ihtara gerek olmaksızın değiştirme, siteyi yeniden organize etme, yayını durdurma hakkını saklı tutar.</p>
        `
    },
    'iptal-iade': {
        title: 'İptal ve İade Koşulları',
        content: `
            <h2>İPTAL VE İADE KOŞULLARI</h2>

            <h3>1. Cayma Hakkı</h3>
            <p>ALICI, 6502 sayılı Tüketicinin Korunması Hakkında Kanun gereği, sözleşme konusu ürünün kendisine veya gösterdiği adresteki kişi/kuruluşa tesliminden itibaren 14 (on dört) gün içinde, hiçbir hukuki ve cezai sorumluluk üstlenmeksizin ve hiçbir gerekçe göstermeksizin malı reddederek sözleşmeden cayma hakkına sahiptir.</p>

            <h3>2. Cayma Hakkının Kullanılamayacağı Ürünler</h3>
            <ul>
                <li>Müşterinin özel istekleri veya kişisel ihtiyaçları doğrultusunda hazırlanan (özel ölçü kablo kesimi, özel üretim paneller vb.) ürünler.</li>
                <li>Montajı yapılmış, kullanılmış, ambalajı bozulmuş, tekrar satılabilirliğini kaybetmiş ürünler (örn: kutusu yırtılmış inverterler, kullanılmış aküler).</li>
            </ul>

            <h3>3. İade Prosedürü</h3>
            <p>İade edilecek ürünlerin kutusu, ambalajı, varsa standart aksesuarları ile birlikte eksiksiz ve hasarsız olarak teslim edilmesi gerekmektedir. İade işlemleriniz için lütfen önce info@icelsolarmarket.com adresine veya 0538 767 70 71 nolu telefona bilgi veriniz.</p>

            <h3>4. Ücret İadesi</h3>
            <p>İade edilen ürünün depomuza ulaşması ve uygunluk kontrolünün (hasarsızlık vb.) yapılmasının ardından, ürün bedeli 10 gün içinde kredi kartınıza/banka hesabınıza iade edilir. Bankanızın iadeyi hesabınıza yansıtma süresi banka prosedürlerine göre değişiklik gösterebilir.</p>
        `
    },
    'mesafeli-satis-sozlesmesi': {
        title: 'Mesafeli Satış Sözleşmesi',
        content: `
            <h2>MESAFELİ SATIŞ SÖZLEŞMESİ</h2>

            <p><strong>1. TARAFLAR</strong></p>
            <p>İşbu Sözleşme aşağıdaki taraflar arasında aşağıda belirtilen hüküm ve şartlar çerçevesinde imzalanmıştır.</p>

            <p><strong>ALICI:</strong><br>
            AD-SOYAD: [Sipariş Esnasında Belirtilir]<br>
            ADRES: [Sipariş Esnasında Belirtilir]<br>
            TELEFON: [Sipariş Esnasında Belirtilir]<br>
            EPOSTA: [Sipariş Esnasında Belirtilir]</p>

            <p><strong>SATICI:</strong><br>
            AD-SOYAD/ÜNVAN: İçel Solar Market<br>
            ADRES: Barış, Bahçeler Cd. Eroğlu plaza No:30/21, 33010 Akdeniz/Mersin<br>
            TELEFON: 0538 767 70 71 - 0324 336 63 36<br>
            EPOSTA: info@icelsolarmarket.com</p>
            
            <p>İş bu sözleşmeyi kabul etmekle ALICI, sözleşme konusu siparişi onayladığı takdirde sipariş konusu bedeli ve varsa kargo ücreti, vergi gibi belirtilen ek ücretleri ödeme yükümlülüğü altına gireceğini ve bu konuda bilgilendirildiğini peşinen kabul eder.</p>

            <p><strong>2. TANIMLAR</strong></p>
            <p>İşbu sözleşmenin uygulanmasında ve yorumlanmasında aşağıda yazılı terimler karşılarındaki yazılı açıklamaları ifade edeceklerdir.</p>
            <ul>
                <li><strong>BAKAN:</strong> Gümrük ve Ticaret Bakanı’nı,</li>
                <li><strong>BAKANLIK:</strong> Gümrük ve Ticaret Bakanlığı’nı,</li>
                <li><strong>KANUN:</strong> 6502 sayılı Tüketicinin Korunması Hakkında Kanun’u,</li>
                <li><strong>YÖNETMELİK:</strong> Mesafeli Sözleşmeler Yönetmeliği’ni,</li>
                <li><strong>HİZMET:</strong> Bir ücret veya menfaat karşılığında yapılan ya da yapılması taahhüt edilen mal sağlama dışındaki her türlü tüketici işlemini,</li>
                <li><strong>SATICI:</strong> Ticari veya mesleki faaliyetleri kapsamında tüketiciye mal sunan veya mal sunan adına veya hesabına hareket eden şirketi,</li>
                <li><strong>ALICI:</strong> Bir mal veya hizmeti ticari veya mesleki olmayan amaçlarla edinen, kullanan veya yararlanan gerçek ya da tüzel kişiyi,</li>
                <li><strong>SİTE:</strong> SATICI’ya ait internet sitesini,</li>
                <li><strong>SİPARİŞ VEREN:</strong> Bir mal veya hizmeti SATICI’ya ait internet sitesi üzerinden talep eden gerçek ya da tüzel kişiyi,</li>
                <li><strong>TARAFLAR:</strong> SATICI ve ALICI’yı,</li>
                <li><strong>SÖZLEŞME:</strong> SATICI ve ALICI arasında akdedilen işbu sözleşmeyi,</li>
                <li><strong>MAL:</strong> Alışverişe konu olan taşınır eşyayı ve elektronik ortamda kullanılmak üzere hazırlanan yazılım, ses, görüntü ve benzeri gayri maddi malları,</li>
            </ul>

            <p><strong>3. KONU</strong></p>
            <p>İşbu Sözleşme, ALICI’nın, SATICI’ya ait internet sitesi üzerinden elektronik ortamda siparişini verdiği aşağıda nitelikleri ve satış fiyatı belirtilen ürünün satışı ve teslimi ile ilgili olarak 6502 sayılı Tüketicinin Korunması Hakkında Kanun ve Mesafeli Sözleşmelere Dair Yönetmelik hükümleri gereğince tarafların hak ve yükümlülüklerini düzenler.</p>
            <p>Listelenen ve sitede ilan edilen fiyatlar satış fiyatıdır. İlan edilen fiyatlar ve vaatler güncelleme yapılana ve değiştirilene kadar geçerlidir. Süreli olarak ilan edilen fiyatlar ise belirtilen süre sonuna kadar geçerlidir.</p>

            <p><strong>4. SATICI BİLGİLERİ</strong></p>
            <p>Ünvanı: İçel Solar Market<br>
            Adres: Barış, Bahçeler Cd. Eroğlu plaza No:30/21, 33010 Akdeniz/Mersin<br>
            Telefon: 0538 767 70 71 - 0324 336 63 36<br>
            Eposta: info@icelsolarmarket.com</p>

            <p><strong>5. ALICI BİLGİLERİ</strong></p>
            <p>Teslim edilecek kişi: [Sipariş Esnasında Belirtilir]<br>
            Teslimat Adresi: [Sipariş Esnasında Belirtilir]<br>
            Telefon: [Sipariş Esnasında Belirtilir]<br>
            Eposta/kullanıcı adı: [Sipariş Esnasında Belirtilir]</p>

            <p><strong>6. SİPARİŞ VEREN KİŞİ BİLGİLERİ</strong></p>
            <p>Ad/Soyad/Unvan: [Sipariş Esnasında Belirtilir]<br>
            Adres: [Sipariş Esnasında Belirtilir]<br>
            Telefon: [Sipariş Esnasında Belirtilir]<br>
            Eposta/kullanıcı adı: [Sipariş Esnasında Belirtilir]</p>

            <p><strong>7. SÖZLEŞME KONUSU ÜRÜN/ÜRÜNLER BİLGİLERİ</strong></p>
            <p>7.1. Malın/Ürün/Ürünlerin/Hizmetin temel özelliklerini (türü, miktarı, marka/modeli, rengi, adedi) SATICI’ya ait internet sitesinde yayınlanmaktadır. Satıcı tarafından kampanya düzenlenmiş ise ilgili ürünün temel özelliklerini kampanya süresince inceleyebilirsiniz. Kampanya tarihine kadar geçerlidir.</p>

            <p>7.2. Fiyatlar<br>
            Listelenen ve sitede ilan edilen fiyatlar satış fiyatıdır. İlan edilen fiyatlar ve vaatler güncelleme yapılana ve değiştirilene kadar geçerlidir. Süreli olarak ilan edilen fiyatlar ise belirtilen süre sonuna kadar geçerlidir.</p>

            <p>7.3. Vergiler ve Ödemeler<br>
            Sözleşme konusu mal ya da hizmetin tüm vergiler dâhil satış fiyatı aşağıda gösterilmiştir.</p>
            
            <p>[Ürün Listesi ve Toplam Tutar Sipariş Esnasında Belirtilir]</p>

            <p><strong>8. FATURA BİLGİLERİ</strong></p>
            <p>Ad/Soyad/Unvan: [Sipariş Esnasında Belirtilir]<br>
            Adres: [Sipariş Esnasında Belirtilir]<br>
            Telefon: [Sipariş Esnasında Belirtilir]<br>
            Eposta/kullanıcı adı: [Sipariş Esnasında Belirtilir]<br>
            Fatura teslim: Fatura sipariş teslimatı sırasında fatura adresine sipariş ile birlikte teslim edilecektir.</p>

            <p><strong>9. GENEL HÜKÜMLER</strong></p>
            <p>9.1. Bilgilendirme ve Kabul<br>
            ALICI, SATICI’ya ait internet sitesinde sözleşme konusu ürünün temel nitelikleri, satış fiyatı ve ödeme şekli ile teslimata ilişkin ön bilgileri okuyup, bilgi sahibi olduğunu, elektronik ortamda gerekli teyidi verdiğini kabul, beyan ve taahhüt eder.</p>

            <p>9.2. Teslim Süresi<br>
            Sözleşme konusu her bir ürün, 30 günlük yasal süreyi aşmamak kaydı ile ALICI’nın yerleşim yeri uzaklığına bağlı olarak internet sitesindeki ön bilgiler kısmında belirtilen süre zarfında teslim edilir.</p>

            <p><strong>10. CAYMA HAKKI</strong></p>
            <p>ALICI, mesafeli sözleşmenin mal satışına ilişkin olması durumunda, ürünün kendisine veya gösterdiği adresteki kişi/kuruluşa teslim tarihinden itibaren 14 gün içerisinde, SATICI’ya bildirmek şartıyla hiçbir gerekçe göstermeksizin malı reddederek sözleşmeden cayma hakkını kullanabilir.</p>

            <p><strong>11. CAYMA HAKKI KULLANILAMAYACAK ÜRÜNLER</strong></p>
            <p>ALICI’nın isteği veya açıkça kişisel ihtiyaçları doğrultusunda hazırlanan, iç giyim alt parçaları, makyaj malzemeleri, tek kullanımlık ürünler gibi ürünler cayma hakkı kapsamı dışında kalmaktadır. (Solar ürünleri için ayrıca: Montajı yapılmış, kullanılmış, ambalajı bozulmuş, tekrar satılabilirliğini kaybetmiş ürünler iade alınamaz.)</p>

            <p><strong>12. TEMERRÜT HALİ VE HUKUKİ SONUÇLARI</strong></p>
            <p>ALICI, ödeme işlemlerini kredi kartı ile yaptığı durumda temerrüde düştüğü takdirde, kart sahibi banka ile arasındaki kredi kartı sözleşmesi çerçevesinde faiz ödeyeceğini ve bankaya karşı sorumlu olacağını kabul, beyan ve taahhüt eder.</p>

            <p><strong>13. YETKİLİ MAHKEME</strong></p>
            <p>İşbu sözleşmeden doğan uyuşmazlıklarda şikayet ve itirazlar, tüketicinin yerleşim yerinin bulunduğu veya tüketici işleminin yapıldığı yerdeki tüketici sorunları hakem heyetine veya tüketici mahkemesine yapılacaktır.</p>

            <p><strong>14. YÜRÜRLÜK</strong></p>
            <p>ALICI, Site üzerinden verdiği siparişe ait ödemeyi gerçekleştirdiğinde işbu sözleşmenin tüm şartlarını kabul etmiş sayılır.</p>
        `
    },
    'kvkk-aydinlatma-metni': {
        title: 'KVKK Aydınlatma Metni',
        content: `
            <h2>İÇEL SOLAR MARKET KİŞİSEL VERİLERİN KORUNMASI VE İŞLENMESİ AYDINLATMA METNİ</h2>
            
            <p><strong>Veri Sorumlusu:</strong> İçel Solar Market<br>
            <strong>Adres:</strong> Barış, Bahçeler Cd. Eroğlu plaza No:30/21, 33010 Akdeniz/Mersin<br>
            <strong>E-posta:</strong> info@icelsolarmarket.com</p>

            <p>6698 sayılı Kişisel Verilerin Korunması Kanunu (“KVKK”) uyarınca, kişisel verileriniz; veri sorumlusu olarak Şirketimiz tarafından aşağıda açıklanan kapsamda işlenebilecektir.</p>

            <h3>1. Kişisel Verilerin İşlenme Amacı</h3>
            <p>Toplanan kişisel verileriniz (Ad, soyad, adres, telefon, e-posta, sipariş bilgileri, IP adresi);</p>
            <ul>
                <li>Siparişlerinizin alınması, ürünlerin tarafınıza teslim edilmesi,</li>
                <li>Ödeme işlemlerinin güvenli bir şekilde gerçekleştirilmesi,</li>
                <li>Müşteri hizmetleri faaliyetlerinin yürütülmesi,</li>
                <li>Yasal yükümlülüklerin yerine getirilmesi (Fatura kesimi, vergi mevzuatı vb.),</li>
            </ul>
            <p>amaçlarıyla işlenmektedir.</p>

            <h3>2. İşlenen Kişisel Verilerin Kimlere ve Hangi Amaçla Aktarılabileceği</h3>
            <p>Kişisel verileriniz; siparişin teslimi için kargo şirketleriyle, ödemenin alınması için ilgili banka veya ödeme kuruluşlarıyla (Iyzico/PayTR vb.) ve yasal zorunluluk halinde yetkili kamu kurum ve kuruluşlarıyla paylaşılabilmektedir. Harici olarak üçüncü şahıslarla pazarlama amacıyla paylaşılmamaktadır.</p>

            <h3>3. Kişisel Veri Toplamanın Yöntemi ve Hukuki Sebebi</h3>
            <p>Kişisel verileriniz, internet sitemiz üzerinden elektronik ortamda, sözleşmenin kurulması ve ifası hukuki sebebine dayalı olarak toplanmaktadır.</p>

            <h3>4. Veri Sahibinin Hakları (KVKK Madde 11)</h3>
            <p>Kanun’un 11. maddesi uyarınca; verilerinizin işlenip işlenmediğini öğrenme, işlenmişse bilgi talep etme, verilerin düzeltilmesini veya silinmesini isteme haklarına sahipsiniz. Taleplerinizi info@icelsolarmarket.com adresine iletebilirsiniz.</p>
        `
    }
};

const LegalPage: React.FC = () => {
    const { slug } = useParams<{ slug: string }>();
    const [pageContent, setPageContent] = useState<LegalContent | null>(null);

    useEffect(() => {
        if (slug && legalPages[slug]) {
            setPageContent(legalPages[slug]);
        } else {
            setPageContent({
                title: 'Sayfa Bulunamadı',
                content: '<p>Aradığınız sayfa bulunamadı.</p>'
            });
        }
    }, [slug]);

    if (!pageContent) {
        return (
            <div className="min-h-screen bg-[#fefcf5] flex items-center justify-center">
                <div className="animate-spin h-12 w-12 border-4 border-[#f0c961] rounded-full border-t-transparent"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#fefcf5] py-16">
            <div className="container mx-auto px-4 max-w-4xl">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 md:p-12">
                    <h1 className="text-3xl font-bold text-gray-900 mb-8 pb-4 border-b border-gray-200">
                        {pageContent.title}
                    </h1>
                    <div
                        className="prose prose-lg max-w-none text-gray-700 leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: pageContent.content }}
                    />
                </div>
            </div>
        </div>
    );
};

export default LegalPage;
