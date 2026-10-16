<div align="center">

# REA Improved

### Tersine mühendislik için tek CLI ve MCP — kanıtı gösterir, bilinmeyeni saklamaz.

REA’nın açık kaynak kod tabanından türetilmiş, özellikleri korumayı ve analiz akışlarını daha güvenilir hâle getirmeyi hedefleyen topluluk sürümü.

[![Temel sürüm](https://img.shields.io/badge/kod%20taban%C4%B1-REA%206.5.0-5267df?style=for-the-badge)](https://github.com/morluto/rea)
[![TypeScript](https://img.shields.io/badge/TypeScript-457.8K%2B%20sat%C4%B1r-3178c6?style=for-the-badge&logo=typescript&logoColor=white)](src/)
[![Kaynak dosyası](https://img.shields.io/badge/src-1%2C966%20dosya-444444?style=for-the-badge)](src/)
[![MCP + CLI](https://img.shields.io/badge/MCP-CLI%20bir%20arada-8a45cf?style=for-the-badge)](docs/mcp-contracts.md)
[![MIT](https://img.shields.io/badge/lisans-MIT-f4c430?style=for-the-badge)](LICENSE)
[![Kaynak paketi](https://img.shields.io/badge/kaynak%20ZIP-21.37%20MiB-238636?style=for-the-badge)](https://github.com/sancheznk/rea-improved/releases/latest/download/rea-improved-source.zip)

**[Başlangıç](#başlangıç) · [Neler değişti](#rea-improved-ne-ekliyor) · [Araçlar](#neleri-inceleyebilir) · [Komut kılavuzu](docs/rea-improved-kullanim-ve-komutlar.md) · [Güvenlik](#kanıt-ve-güvenlik)**

<a href="https://t.me/kaliyim"><img src="https://img.shields.io/badge/Telegram-@kaliyim-26A5E4?style=for-the-badge&logo=telegram&logoColor=white" alt="Telegram: @kaliyim" /></a>

</div>

> **Bu proje bağımsız bir topluluk fork’udur.** `morluto/rea` projesinden ve MIT lisanslı kaynak kodundan türetilmiştir; REA’nın orijinal geliştiricisiyle bağlantılı veya onun tarafından onaylanmış resmî bir dağıtım değildir. Orijinal projeye ve mevcut telif bildirimlerine saygı gösterir. Buradaki değişiklikler bu depodaki sürüme aittir; upstream npm paketiyle aynı şey değildir.

## Kısaca

REA, ajanlara ve terminal kullanıcılarına uygulama ve ikili dosyaları araştırma araçları sunar. Aynı iş akışları hem komut satırından hem MCP üzerinden kullanılabilir. Sonuçlar, yalnızca bir yorum vermek yerine hangi dosya ve analiz kanıtlarına dayandığını; nerede belirsizlik kaldığını da taşır.

Bu depo, 16 Ekim 2026 tarihli geliştirme anlık görüntüsünde upstream **6.5.0** kod tabanını temel alır. `src/` altında **1.966 TypeScript/TSX dosyası ve 457.865 satır** sayıldı. Kaynak teslim ZIP’i, sabitlenmiş beş alt modülün kaynaklarıyla birlikte **21,37 MiB**’tır. Sayılar bu anlık görüntü için ölçülmüştür; yeni commit’lerle değişebilir. ZIP, `node_modules`, ana projenin derleme çıktıları, Git geçmişi, üretilmiş ekstraksiyon çıktıları ve örnek APK’yı içermez.

## REA Improved ne ekliyor?

- **Daha okunabilir Android manifest incelemesi:** bileşenleri sayfalar; literal `android:exported` değerlerini, intent action/category ve URI/MIME bildirimlerini, alias hedeflerini, provider authority/izinlerini, uygulama bayraklarını, istenen izinleri ve donanım özelliklerini verir.
- **Kaynaklar arası çapraz kontrol:** JADX’in paket metaverisi ile saklanan manifest beyanları farklıysa kaynakları birleştirip farkı gizlemek yerine ayrı bir uyarı gösterir. Eski `intent_filter_count` alanı korunur. Eksik action/category adları `null` olarak kalır; tanınmayan intent-filter etiketleri görünür biçimde raporlanır.
- **Kanıta bağlı Android iş akışı:** manifestten seçilmiş sınıf ve metoda, oradan referanslara; ayrıca arşiv envanteri ve uygulama grafiğine ilerleyen ajan yönergesi eklendi. Farklı araçlardan gelen bilgiler, aynı APK SHA-256’sı üzerinden izlenebilir.
- **Daha kontrollü kaynak kullanımı:** JADX için isteğe bağlı iş parçacığı ayarı eklendi; varsayılan bir iş parçacığı olarak kaldı. Büyük batch işlemlerinin paralelliği sınırlandırıldı; iptal ve oturum temizliği için regresyon testleri eklendi.
- **Daha sağlam analiz kaydı:** iptal edilen tarayıcı senaryolarında kısmi gözlemler korunur; Apktool sonuçlarında doğrulanmış hedef kimliği Evidence’a taşınır.

Bunlar mevcut özelliklerin yerine yeni bir ürün yazmak değil; REA’nın mevcut iş akışlarına eklenen, geriye uyumluluğu gözeten geliştirmelerdir. Android akışları, kullanıcı tarafından sağlanan bir APK üzerinde statik olarak test edildi; örnek APK bu depoda veya kaynak paketinde dağıtılmaz.

## Neleri inceleyebilir?

| Alan                              | Örnekler                                                                   | Ek gereksinimler                                                              |
| --------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Yerel ikili dosyalar              | Sembol, string, fonksiyon, assembly, sözde kod ve referanslar              | Hopper, Ghidra veya IDA gibi yapılandırılmış analiz sağlayıcısı               |
| Android                           | APK manifesti, sınıflar, metotlar, DEX referansları ve kaynaklar           | JADX + tam JDK; Apktool ile kaynak çapraz kontrolü isteğe bağlı               |
| JavaScript / Electron             | Paketler, import’lar, kaynak haritaları, rotalar, IPC ve native eklentiler | Node.js; hedef türüne göre ek runtime araçları                                |
| Web ve kayıtlı trafik             | Sayfa gözlemi, HAR/SAZ/qlog ve pcap incelemesi                             | Chrome ailesi tarayıcısı veya ilgili ağ aracı                                 |
| .NET, Go, Rust, WASM, EVM, SQLite | Metadata, arayüzler, kaynaklar, şema ve karşılaştırmalar                   | Hedefe göre; WASM ve bazı ikili analizlerinde harici araç gerekir             |
| Firmware ve diğer paketler        | Arşiv envanteri, güvenli çıkarım, firmware bölgeleri                       | Binwalk/Unblob ve format özelinde araçlar gerekebilir                         |
| Cihaz ve süreç gözlemi            | Android cihaz, tarayıcı, Electron, yerel UI ve PTY senaryoları             | adb, Frida, tarayıcı veya ilgili yerel runtime; kullanım hedefi etkileyebilir |

REA’nın desteklediği tüm formatları ve platformları görmek için [Türkçe kapsam tablosuna](docs/readme/README_tr.md#neleri-analiz-edebilirsiniz), araç koşulları için de [kurulum belgesine](docs/installation.md) bakın.

## Başlangıç

Kaynak checkout’unda komutları doğrudan çalıştırabilirsiniz:

```bash
git clone https://github.com/sancheznk/rea-improved.git
cd rea-improved
npm ci
npm run compile
node scripts/rea.mjs --help
```

REA’nın ajan kurulum sihirbazı:

```bash
node scripts/rea.mjs setup
```

Sihirbaz hedef ajanları ve yapılacak değişiklikleri gösterir; planı inceleyip onaylayın. Belirli entegrasyonlar için `setup --help` ve [desteklenen ajanlar listesine](docs/installation.md#supported-agents) bakın.

**Önemli:** `npx rea-agents setup` npm’deki `rea-agents` dağıtımını kullanır; bu fork’un geliştirme sürümünü otomatik olarak yüklemez. REA Improved değişikliklerini denemek için bu depoyu klonlayıp yerel `node scripts/rea.mjs ...` komutlarını kullanın. Kurulum ve komut örnekleri [kullanım ve komut kılavuzunda](docs/rea-improved-kullanim-ve-komutlar.md) açıklanmıştır.

## Hızlı komutlar

```bash
# Komutların tamamı ve seçenekleri
node scripts/rea.mjs --help
node scripts/rea.mjs analyze --help

# Sağlayıcıları ve yetenekleri gör
node scripts/rea.mjs providers --json
node scripts/rea.mjs capabilities --json

# Örnek: çıkarılmış bir JavaScript/Electron uygulamasını statik incele
node scripts/rea.mjs analyze-javascript-application /mutlak/yol/uygulama --json
```

Native ikili dosyalar, APK, saklanan Evidence ve MCP kullanımı için örnekler ayrı [komut kılavuzunda](docs/rea-improved-kullanim-ve-komutlar.md) yer alıyor. Büyük araç kataloğu [MCP sözleşmeleri ve kataloğunda](docs/mcp-contracts.md#generated-catalog) bulunur.

## Kanıt ve güvenlik

Statik inceleme, hedef uygulamayı çalıştırmakla aynı şey değildir. Yine de cihaz, süreç, tarayıcı, Frida veya benzeri runtime komutları hedefte işlem yapabilir. Yalnızca inceleme yetkiniz olan dosya, cihaz ve sistemlerde kullanın; her aracın kendi belgesini ve olası etkilerini kontrol edin. Manifest beyanları tek başına çalışma zamanı erişilebilirliği, güvenlik açığı veya exploitability kanıtlamaz.

REA’nın her sonucu için kaynak, SHA-256, kapsam ve belirsizlik bilgilerini korumaya çalışır. Örnek APK, bu geliştirme sırasında statik olarak incelenmiştir; kurulmamış ve çalıştırılmamıştır. **Bu depo güvenlik sertifikası veya bağımsız denetim iddiasında bulunmaz.**

## Testler

16 Ekim 2026’da doğrulanan son geliştirme anlık görüntüsünde:

- `npm run compile` — başarılı
- `npm run check:fast` — başarılı
- `npm run docs:check` — başarılı
- `npm run test:fast` — **553 test dosyası geçti; 8.466 test başarılı, 8 atlandı**
- Android manifest görünümü için üretici, şema, CLI ve MCP testleri — **52/52 başarılı**

Atlanan testler repo test grubu tarafından açıkça skip edilen testlerdir. Bu sonuçlar belirtilen kod anlık görüntüsüne aittir; sonraki değişiklikler için yeniden çalıştırılmalıdır.

## Lisans ve atıf

Bu kod tabanı upstream’den MIT lisansı altında alınmıştır. Kökteki [LICENSE](LICENSE) ve [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) dosyalarını dağıtımda koruyun; üçüncü taraf bileşenlerin kendi lisans bildirimleri de geçerlidir. Orijinal proje: [morluto/rea](https://github.com/morluto/rea). Bu topluluk fork’u, upstream’in resmî npm paketinin yerine geçmez.

## Belgeler

- [Türkçe kullanım ve komut kılavuzu](docs/rea-improved-kullanim-ve-komutlar.md)
- [Kurulum ve ajan entegrasyonları](docs/installation.md)
- [CLI ve Evidence](docs/cli.md)
- [MCP sözleşmeleri ve araç kataloğu](docs/mcp-contracts.md)
- [Android analizi](docs/android-analysis.md)
- [Tüm Türkçe REA belgeleri](docs/readme/README_tr.md)
- [Kaynak paketi ve alt modül notları](SOURCE_BUNDLE_README.md)
- [Telegram: @kaliyim](https://t.me/kaliyim)
