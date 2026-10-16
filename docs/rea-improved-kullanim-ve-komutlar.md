# REA Improved: kullanım ve komut kılavuzu

Bu kılavuz, REA Improved kaynak checkout’unu çalıştırmak ve günlük incelemelerde kullanılan komutları bulmak için hazırlandı. Örneklerde `rea` yerine kaynak dizininden çalıştırırken `node scripts/rea.mjs` yazabilirsiniz. Başka bir aracı kurmadan önce hedef ve sağlayıcı gereksinimini ilgili bağlantıdan kontrol edin.

> **Fork notu:** `npx rea-agents` npm’de yayımlanmış upstream paketi açar; bu komut bu checkout’taki değişiklikleri kullanmaz. Bu sürümü denemek için depoyu klonlayıp aşağıdaki yerel komutları çalıştırın.

## 1. Gereksinimler ve ilk çalıştırma

REA, Node.js `22.19+`, `24.11+` veya `26+` ile npm gerektirir. Hedefe özel araçlar ayrıca kurulabilir.

```bash
git clone https://github.com/sancheznk/rea-improved.git
cd rea-improved
npm ci
npm run compile
node scripts/rea.mjs --version
node scripts/rea.mjs --help
```

CLI bütün komutları ve seçenekleri listeler. Bir komutun ayrıntılı sözdizimi için `--help` ekleyin:

```bash
node scripts/rea.mjs analyze --help
node scripts/rea.mjs inspect-android-package --help
node scripts/rea.mjs inspect-analysis-view --help
```

Bir ajana yerel kaynak checkout’unu kurmak için:

```bash
node scripts/rea.mjs setup
```

Kurulum sihirbazı algılanan ajanı, MCP girişini ve skill değişikliklerini gösterir. Uygulamadan önce planı inceleyip onaylayın. Belirli ajan adları ve destek koşulları için [`docs/installation.md`](installation.md) belgesini kullanın. Bir MCP istemcisini elle kaydetmek veya doğrulamak için:

```bash
node scripts/rea.mjs mcp --help
node scripts/rea.mjs mcp add --help
node scripts/rea.mjs mcp doctor --help
```

Sürüm kontrolündeki kaynak checkout’unu güncellemek için Git kullanın (`git pull` ve sonra `npm ci`/`npm run compile`). `rea update` global/npx kurulumu içindir; fork’un Git checkout’unu güncellemez.

## 2. Önce sağlayıcıyı ve etkileri kontrol edin

```bash
node scripts/rea.mjs providers --json
node scripts/rea.mjs capabilities --json
node scripts/rea.mjs doctor --help
```

`providers`, desteklenen binary sağlayıcılarını; `capabilities`, araçların kullanılabilirliğini ve yan etkilerini gösterir. Gerekli motor kurulu değilse önce [kurulum rehberini](installation.md) ve hedefe özel dokümanı izleyin. Hopper, Ghidra, IDA, JADX gibi sağlayıcılarda teşhis için:

```bash
node scripts/rea.mjs doctor --provider ghidra --json
node scripts/rea.mjs doctor --provider jadx --json
```

Her sağlayıcı her hedefi desteklemez. Birden fazla sağlayıcı varsa `--provider` ile seçimi açıkça yapın.

## 3. Native ikili dosya incelemesi

Aşağıdaki örneklerde `/mutlak/yol/program` hedef dosyanız; sağlayıcı ise makinenizde yapılandırılmış Hopper, Ghidra veya IDA’dır:

```bash
# Genel görünüm
node scripts/rea.mjs analyze /mutlak/yol/program --provider ghidra --json

# Metin/byte araması ve fonksiyon incelemesi
node scripts/rea.mjs search /mutlak/yol/program "aranan_metni" --provider ghidra --json
node scripts/rea.mjs function /mutlak/yol/program main --provider ghidra --json

# Adres üzerinden pseudocode, assembly ve referanslar
node scripts/rea.mjs decompile /mutlak/yol/program 0x1000 --provider ghidra --json
node scripts/rea.mjs instructions /mutlak/yol/program 0x1000 --provider ghidra --json
node scripts/rea.mjs xrefs /mutlak/yol/program 0x1000 --provider ghidra --json

# Bir özelliğin izini sürme
node scripts/rea.mjs trace /mutlak/yol/program "aranan_metni" --provider ghidra --json
```

Adres ve arama biçimleri sağlayıcıya bağlıdır. Her komutun `--help` çıktısını ve [native analiz belgesini](native-investigation.md) esas alın.

## 4. JavaScript ve Electron

Çıkarılmış uygulama dizinini veya desteklenen ASAR dosyasını statik inceleyin:

```bash
node scripts/rea.mjs analyze-javascript-application /mutlak/yol/uygulama --json > app-evidence.json
```

REA modüller, import ilişkileri, seçilmiş Electron sınırları ve kaynak kökeni gibi bulguları döndürür. Büyük Evidence çıktısını terminale basmak yerine dosyaya kaydedin. İş akışları, sınırlar ve kapsam için [JavaScript uygulama kılavuzuna](javascript-application-workflows.md) bakın.

## 5. Android APK ve manifest

Android paket analizi için tam bir JDK ve pinned `jadx-headless-mcp` gerekir. Bu, APK’yı kurup çalıştırmaz:

```bash
node scripts/rea.mjs inspect-android-package /mutlak/yol/app.apk --json > apk-evidence.json
node scripts/rea.mjs inspect-android-class /mutlak/yol/app.apk com.example.MainActivity --json
node scripts/rea.mjs inspect-android-method /mutlak/yol/app.apk com.example.MainActivity onCreate --json
node scripts/rea.mjs trace-android-references /mutlak/yol/app.apk com.example.MainActivity --json
```

Metot adları birden fazla overload’a sahipse önce sınıf envanterini alın, sonra `--overload-index` ile doğru overload’u seçin. APK’nın manifestini ve seçilen string kaynaklarını bağımsız Apktool iş akışıyla incelemek için:

```bash
node scripts/rea.mjs decode-android-resources /mutlak/yol/app.apk --json
```

### Saklanan APK Evidence’ından yapılandırılmış manifest yüzeyi

`inspect_android_package` sonucu tamamlandıktan sonra `inspect_analysis_view` bu Evidence’ı tekrar kullanarak bileşenleri, literal export değerlerini, intent action/category ve URI/MIME alanlarını, provider authority’lerini, izinleri ve donanım özelliklerini sayfalı olarak projeler. Yeni JADX oturumu başlatmak yerine saklanmış kanıttan okur.

```bash
node scripts/rea.mjs inspect-analysis-view --help
node scripts/rea.mjs inspect-analysis-view --schema
```

Bu komut, doğrulanmış Evidence JSON’unu inline `source` olarak ve şu görünüm seçicisini alan bir JSON dosyası bekler:

```json
{
  "source": {
    "kind": "inline",
    "evidence": "<inspect-android-package çıktısındaki Evidence nesnesi>"
  },
  "view": { "kind": "android-manifest-surface", "offset": 0, "limit": 64 }
}
```

`<...>` ifadesini gerçek Evidence nesnesiyle değiştirin; bu bir komut satırı parametresi değil örnek şablondur. Sayfalama varsa yanıttaki `coverage.next_offset` değerinden devam edin. `intent_filter_count` alanı eski istemciler için korunur. Bilinmeyen XML alt etiketleri açıklanır; manifest bildirimi tek başına gerçek çalışma zamanı yönlendirmesini veya zafiyeti kanıtlamaz. Ayrıntılar: [Android analiz rehberi](android-analysis.md).

## 6. Artifact, firmware ve başka statik incelemeler

```bash
# Arşiv/paket envanteri ve kanıt
node scripts/rea.mjs inspect-artifact /mutlak/yol/paket.zip --json

# Firmware bölgelerini inceleme; çıkarma ayrı bir işlemdir
node scripts/rea.mjs inspect-firmware-regions /mutlak/yol/firmware.bin --json
node scripts/rea.mjs extract-firmware /mutlak/yol/firmware.bin --json

# .NET metadata ve üyeleri; hedef kodunu yüklemeden
node scripts/rea.mjs inspect-managed-artifact /mutlak/yol/Assembly.dll --json
node scripts/rea.mjs inspect-managed-members /mutlak/yol/Assembly.dll --json

# Go/Rust metadata veya SQLite snapshot
node scripts/rea.mjs inspect-go-binary /mutlak/yol/program --json
node scripts/rea.mjs inspect-rust-binary /mutlak/yol/program --json
node scripts/rea.mjs inspect-sqlite-database /mutlak/yol/data.db --json
```

Her formatın koşulu farklıdır; tam seçenek ve çıktı sözleşmesi `komut --help` ve ilgili rehberde yer alır.

## 7. Evidence, karşılaştırma ve snapshot

REA sonuçları artifact kimliği, kaynak konumları, gözlemler ve çözümlenmemiş noktalarla Evidence olarak döner. İki Evidence kaydını karşılaştırma, dışa aktarma ve içe aktarma örnekleri:

```bash
node scripts/rea.mjs compare left-evidence.json right-evidence.json --json
node scripts/rea.mjs evidence-export input-evidence.json canonical-evidence.json
node scripts/rea.mjs evidence-import canonical-evidence.json
```

Uygun yerel analiz sonuçlarını saklayıp yeniden kullanmak için `--snapshot /mutlak/yol/snapshot.json` seçeneği kullanılabilir. Snapshot’ın neyi önbelleğe aldığına ve hangi işlemlerde geçersizleştiğine dair kurallar için [CLI ve Evidence rehberini](cli.md) okuyun. Snapshot bir sağlayıcı projesinin veya canlı hedefin birebir yedeği değildir.

## 8. Çıktı biçimleri ve büyük sonuçlar

Desteklenen biçimler `toon`, `json`, `yaml`, `md` ve `jsonl`’dir. Varsayılanı değiştirmek için örneğin `--format json` kullanın. MCP/JSON çıktısını kaydetmek için:

```bash
node scripts/rea.mjs analyze /mutlak/yol/program --provider ghidra --format json > evidence.json
```

`--full-output` zarfı ve tanı ayrıntılarını ekler; yalnızca komutun normalleştirilmiş sonucuna ihtiyacınız varsa kullanmayın. Büyük analizlerde `--token-limit`, `--token-offset` veya `inspect-analysis-view` ile sonucu parçalara ayırın.

## 9. Sık kullanılan geliştirme kontrolleri

```bash
npm run compile
npm run check:fast
npm run docs:check
npm run test:fast
```

Bu depodaki 16 Ekim 2026 geliştirme anlık görüntüsünde tam hızlı test grubu 553 dosya ve 8.466 başarılı testle geçti; 8 test skip edildi. Yeni değişiklikler yaptıktan sonra kendi ortamınızda yeniden çalıştırın.

## 10. Çalıştırma etkileri ve güvenli kullanım

Statik analiz çoğunlukla dosya içeriğini okur. Ancak adb, Frida, tarayıcı, Electron, GDB, süreç yakalama, Android uygulama başlatma/kurma ve bazı native-provider işlemleri hedef sistemle etkileşime girebilir. Bunları yalnızca yetkiniz olan hedeflerde kullanın; `capabilities --json`, her komutun `--help` çıktısı ve ilgili kılavuzdan yan etkileri kontrol edin. `install-adb-package`, `uninstall-adb-package`, `start-adb-app` ve benzeri cihaz komutlarını pasif inceleme sanmayın.

## Daha fazla bilgi

- [Ana README](../README.md)
- [Tam CLI ve Evidence rehberi](cli.md)
- [MCP sözleşmeleri ve üretilen araç kataloğu](mcp-contracts.md)
- [Kurulum ve desteklenen ajanlar](installation.md)
- [Android analizi ve JADX kurulumu](android-analysis.md)
- [Türkçe kapsam tablosu](readme/README_tr.md)
