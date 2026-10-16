# Kaynak paketi ve kurulum notu

Bu proje, MIT lisanslı [`morluto/rea`](https://github.com/morluto/rea) kaynak kodundan türetilmiş bağımsız bir topluluk fork’udur. Upstream’in [`LICENSE`](LICENSE) telif ve lisans metnini değiştirmeden korur. Dağıtım yaparken `THIRD_PARTY_NOTICES.md` dosyasını ve üçüncü taraf bileşenlerin kendi lisanslarını da koruyun. Bu proje upstream geliştiricileri tarafından resmen desteklenen bir dağıtım değildir.

## Kaynak arşivi

GitHub’daki kaynak ağacı ve release ekindeki `rea-improved-source.zip` aynı geliştirme anlık görüntüsüne karşılık gelmelidir. Ölçülen ZIP **21,37 MiB** ve 6.585 düzenli dosyadan oluşur; ana proje kaynaklarını, testleri, belgeleri ve REA tarafından sabitlenmiş beş alt modülün kaynak ağaçlarını içerir. Alt modüller şu commit’lere sabitlenmiştir:

| Alt modül                       | Commit                                     |
| ------------------------------- | ------------------------------------------ |
| `third_party/binwalk`           | `4fdab3d464d97b68e0af9088df3f9e2e1545b21c` |
| `third_party/ghidra-nativeaot`  | `effeb734fc570c32650f88b159608979dc7b423e` |
| `third_party/jadx-headless-mcp` | `5844800a486d2248fa949b74c9896285f5b54de2` |
| `third_party/unblob`            | `1fcc7a0a584a70a96c31f5a276c20944d199a089` |
| `third_party/wakaru`            | `8219bf5016a063d7fb215101a8c45d5959ec733f` |

ZIP’te Git geçmişi, `.git` metaverisi, `node_modules`, ana projenin derlenmiş `dist/` çıktısı, çalışma önbellekleri, üretilmiş extraction-output test klasörleri, bir symlink tabanlı fixture ve kullanıcının test ettiği APK bulunmaz. Alt modül depo URL’leri ve commit’leri `.gitmodules` ile superproject kaydında yer alır. Alt modül ilişkileri korunarak klonlamak isterseniz `git clone --recurse-submodules` kullanın.

## Geliştirme kurulumu

Node.js `22.19+`, `24.11+` veya `26+` gerekir:

```bash
git clone --recurse-submodules https://github.com/sancheznk/rea-improved.git
cd rea-improved
npm ci
npm run compile
npm run check:fast
npm run docs:check
npm run test:fast
```

## Harici analiz motorları

Kaynak kodunun pakete dâhil olması, tüm hedef araçlarının hazır kurulu olduğu anlamına gelmez. Android JADX iş akışı tam JDK ve `jadx-headless-mcp` motoru ister. Android kaynaklarını bağımsız çözümlemek için Apktool gerekir. Native analiz Hopper, Ghidra, IDA veya hedefe uygun sağlayıcı ister; diğer formatların da kendi ek gereksinimleri olabilir. README, [`docs/installation.md`](docs/installation.md) ve format rehberleri hangi araçların opsiyonel/harici olduğunu açıklar. Ajan entegrasyonu için yerel checkout’ta `node scripts/rea.mjs setup` kullanın; `npx rea-agents` npm’deki upstream paketini çalıştırır.
