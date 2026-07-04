# P2P Trade Frontend Mimarisi ve Detaylı Analizi

Bu doküman, P2P Trade platformunun frontend katmanının teknik yapısını, mimarisini ve işleyişini detaylı bir şekilde açıklamak amacıyla hazırlanmıştır. Projeye yeni katılacak bir geliştirici için bir başlangıç rehberi niteliğindedir.

## 1. Genel Bakış ve Teknoloji Yığını

Frontend, modern ve reaktif bir web uygulaması olup, kullanıcıların merkeziyetsiz bir şekilde NFT ve token takas teklifleri oluşturmasını, görüntülemesini ve yönetmesini sağlar.

- **Framework**: Next.js 14 (App Router ile)
- **UI Kütüphanesi**: Tailwind CSS & Shadcn UI
- **Cüzdan Entegrasyonu**: Privy
- **Blockchain Etkileşimi**: `ethers.js` ve `wagmi`
- **Durum Yönetimi (State Management)**:
  - **Server State**: TanStack React Query (`@tanstack/react-query`)
  - **Client State**: `useReducer` (karmaşık formlar için) ve `useState`
- **Dil**: TypeScript
- **API İstemcisi**: `fetch` API tabanlı özel bir istemci (`src/lib/api.ts`)

## 2. Proje Yapısı

Frontend projesi, `frontend/src` klasörü altında modüler bir yapıda organize edilmiştir:

```
frontend/src/
├── app/                    # Next.js App Router (Sayfalar ve Yönlendirme)
│   ├── layout.tsx          # Ana layout
│   ├── page.tsx            # Anasayfa
│   ├── create/             # Teklif oluşturma sayfası
│   ├── dashboard/          # Kullanıcı paneli
│   ├── marketplace/        # Tüm tekliflerin listelendiği sayfa
│   └── offer/[id]/         # Tek bir teklifin detay sayfası
├── components/
│   ├── ui/                 # Shadcn UI temel bileşenleri (Button, Card, etc.)
│   ├── create-offer/       # Teklif oluşturma sihirbazı bileşenleri
│   ├── home/               # Anasayfa özel bileşenleri
│   ├── layout/             # Header, Footer gibi layout bileşenleri
│   ├── modals/             # NFT seçimi gibi modal bileşenleri
│   └── proposal/           # Karşı teklif oluşturma paneli
├── contracts/              # Derlenmiş Smart Contract ABI'ları (JSON)
├── hooks/                  # Özel React Hook'ları (data fetching, wallet işlemleri)
├── lib/                    # Yardımcı fonksiyonlar, API istemcisi, kontrat konfigürasyonu
└── types/                  # Proje genelinde kullanılan TypeScript tipleri
```

## 3. Sayfalar ve Yönlendirme (Routing)

Next.js App Router kullanıldığı için `src/app` altındaki klasör yapısı doğrudan URL yapısını belirler.

-   **`/` (Anasayfa - `page.tsx`)**:
    -   **İşlev**: Platformu tanıtan ana sayfa.
    -   **Bileşenler**: `Hero`, `Stats`, `FeaturedOffers`, `HowItWorks`.
    -   **API Çağrıları**: `apiClient.getOfferStats()` ve `apiClient.getOffers({ limit: 6, status: [ACTIVE] })` çağrıları ile anasayfa istatistiklerini ve öne çıkan teklifleri çeker.

-   **`/marketplace` (`marketplace/page.tsx`)**:
    -   **İşlev**: Tüm alım-satım tekliflerinin listelendiği, filtrelenebildiği ve arama yapılabildiği pazar yeri sayfası.
    -   **Hook**: `useOffers` hook'u ile teklifleri backend'den çeker. Filtreleme (durum, arama terimi) ve sayfalama (pagination) işlemleri bu hook üzerinden yönetilir.
    -   **API Çağrıları**: `apiClient.getOffers()` çağrısı, filtre ve sayfalama parametreleriyle yapılır.

-   **`/offer/[id]` (`offer/[id]/page.tsx`)**:
    -   **İşlev**: Belirli bir teklifin tüm detaylarını gösterir. Teklifin varlıkları, durumu, yaratıcısı ve karşı teklifler burada görüntülenir.
    -   **API Çağrıları**:
        -   `apiClient.getOffer(offerId)`: Ana teklif detaylarını çeker.
        -   `apiClient.getOfferCounterOffers(offerId)`: Teklife yapılmış karşı teklifleri (child offers) çeker.
    -   **Kontrat Etkileşimi**:
        -   **Teklif Sahibi İçin**: `handleCancelOffer` fonksiyonu ile `OfferContract.cancelOffer()` çağrılır. `handleAcceptCounterOffer` ile `OfferContract.acceptTargetedOffer(counterOfferAddress)` çağrılır.
        -   **Diğer Kullanıcılar İçin**: `handleFillOffer` ile `P2PTradingFactory.createOfferAndDeposit()` çağrılarak karşı teklif (fill/match) oluşturulur. `RequirementChecker` bileşeni, kullanıcının istenen varlıklara sahip olup olmadığını kontrol eder.

-   **`/create` (`create/page.tsx`)**:
    -   **İşlev**: Kullanıcıların yeni bir takas teklifi oluşturmasını sağlayan çok adımlı sihirbaz (wizard).
    -   **Bileşen**: `CreateOfferWizard` bu sayfanın ana bileşenidir.
    -   **Durum Yönetimi**: `useReducer` ile sihirbazın tüm adımlarındaki (teklif tipi, sunulan varlıklar, istenen varlıklar, detaylar) durum yönetilir.
    -   **Kontrat Etkileşimi**: `handleCreateOffer` fonksiyonu, `P2PTradingFactory.createOfferAndDeposit()` fonksiyonunu çağırarak teklifi on-chain olarak yaratır.

-   **`/dashboard` (`dashboard/page.tsx`)**:
    -   **İşlev**: Giriş yapmış kullanıcının kendi oluşturduğu ve kendisine gelen teklifleri yönettiği panel.
    -   **API Çağrıları**: `apiClient.getUserOffers()` ile kullanıcının "gönderdiği" (made) ve "aldığı" (received) teklifler ayrı sekmelerde listelenir.
    -   **Kontrat Etkileşimi**:
        -   `handleCancelOffer`: Kullanıcının kendi aktif teklifini iptal etmesi için `OfferContract.cancelOffer()` çağırır.
        -   `handleAcceptOffer`: Kendisine gelen bir karşı teklifi kabul etmek için `OfferContract.acceptTargetedOffer()` çağırır.

## 4. API Entegrasyonu

Backend ve Monaliens API ile iletişim `src/lib/api.ts` dosyasındaki `ApiClient` sınıfı üzerinden merkezi olarak yönetilir.

### Backend API (`https://your-api.example.com/api`)

-   `getOffers(params)`: Filtre ve sayfalama seçenekleriyle teklifleri listeler. (`GET /offers`)
-   `getOffer(id)`: Tek bir teklifin detayını getirir. (`GET /offers/:id`)
-   `getUserOffers(address, params)`: Bir kullanıcının gönderdiği veya aldığı teklifleri getirir. (`GET /offers/user/:address`)
-   `getOfferCounterOffers(offerId)`: Bir teklife yapılmış karşı teklifleri listeler. (`GET /offers/:offerId/children`)
-   `getOfferStats()`: Anasayfada gösterilen genel istatistikleri alır. (`GET /offers/stats/summary`)

### Monaliens API (`https://dev.api.monaliens.xyz/api`)

-   `useUserNFTs` hook'u içinde: Bir kullanıcının cüzdanındaki NFT'leri listeler. (`GET /magic-eden/monad-testnet/users/:address/tokens`)
-   `useCollectionMetadata` hook'u içinde: Bir koleksiyonun metadata'sını (resim, isim vb.) getirir. (`GET /magic-eden/monad-testnet/collections/:address`)
-   `useNFTMetadata` hook'u içinde: Tek bir NFT'nin detaylı metadata'sını getirir. (`GET /magic-eden/collections/:address/tokens/:tokenId/owner`)

## 5. Smart Contract Etkileşimi

Blockchain ile tüm etkileşimler `ethers.js` kullanılarak yapılır. `wagmi` ve `Privy` cüzdan yönetimi ve bağlantı için kullanılır.

### 5.1. Kurulum ve Konfigürasyon

-   **`src/lib/contracts.ts`**: Bu dosya, projenin kalbidir.
    -   `P2PTradingFactory` ve `OfferContract`'ın Monad Testnet üzerindeki adreslerini içerir.
    -   Kontratların ABI'larını (`.json` dosyalarından import ederek) dışa aktarır.
    -   `OfferType`, `AssetType`, `OfferStatus` gibi kontratlarla uyumlu `enum` tanımlarını barındırır.

### 5.2. Cüzdan ve Provider Yönetimi

-   **`src/hooks/use-wallet-provider.ts`**: Bu özel hook, cüzdan işlemlerini basitleştirir.
    -   `getProviderAndSigner()`: Privy üzerinden bağlanan cüzdanı kullanarak bir `ethers.BrowserProvider` ve `signer` nesnesi oluşturur. Tüm "write" (yazma) işlemleri bu `signer` ile imzalanır.
    -   `ensureCorrectNetwork()`: Kullanıcının cüzdanının doğru ağda (Monad Testnet) olduğundan emin olur, değilse ağı değiştirmeyi veya eklemeyi tetikler.

### 5.3. Kontrat Fonksiyon Çağrıları

Yazma (state değiştiren) işlemleri genellikle şu akışı takip eder:
1.  Kullanıcı bir butona tıklar (örn: "Create Offer").
2.  İlgili component'teki `handle...` fonksiyonu tetiklenir.
3.  `useWalletProvider` hook'undan `signer` alınır.
4.  `new ethers.Contract(ADDRESS, ABI, signer)` ile kontrat nesnesi oluşturulur.
5.  Gerekli parametreler hazırlanır (genellikle `CreateOfferWizard`'daki gibi state'ten alınır).
6.  Kontrat fonksiyonu çağrılır (örn: `factoryContract.createOfferAndDeposit(...)`).
7.  İşlem hash'i alınır, UI güncellenir ve işlem onayı beklenir (`tx.wait()`).
8.  Başarı veya hata durumuna göre kullanıcıya `toast` bildirimi gösterilir.

**Önemli Fonksiyon Çağrıları:**

-   **Teklif Yaratma (`CreateOfferWizard.tsx`)**:
    -   **Fonksiyon**: `P2PTradingFactory.createOfferAndDeposit()`
    -   **Parametreler**: `_offerType`, `_targetUser`, `_collectionAddress`, `_duration`, `_targetOfferId`, `_title`, `_description`, `_offeredAssets`, `_requestedAssets`.
    -   **Ön İşlemler**: Sunulan NFT'ler için `ERC721.approve(FACTORY_ADDRESS, tokenId)` fonksiyonu çağrılarak Factory kontratına harcama yetkisi verilir. Sunulan MON token miktarı `value` olarak işleme eklenir.

-   **Teklif İptal Etme (`DashboardPage.tsx`, `OfferPage.tsx`)**:
    -   **Fonksiyon**: `OfferContract.cancelOffer()`
    -   **Açıklama**: Sadece teklifi yaratan kişi (`maker`) tarafından çağrılabilir ve sadece `ACTIVE` durumdaki teklifler için geçerlidir.

-   **Karşı Teklifi Kabul Etme (`DashboardPage.tsx`, `OfferPage.tsx`)**:
    -   **Fonksiyon**: `OfferContract.acceptTargetedOffer(counterOfferAddress)`
    -   **Açıklama**: Bir ana teklifin sahibi, o teklife yapılmış bir karşı teklifi (child offer) kabul etmek için bu fonksiyonu ana teklifin kontratı üzerinden çağırır. Parametre olarak kabul edilen karşı teklifin kontrat adresi verilir.

-   **Teklifi Doldurma/Eşleştirme (`OfferPage.tsx` -> `RequirementChecker.tsx`)**:
    -   **Fonksiyon**: `P2PTradingFactory.createOfferAndDeposit()`
    -   **Açıklama**: Bir kullanıcı, mevcut bir teklifi kabul etmek istediğinde, aslında o teklife ayna bir karşı teklif oluşturur.
        -   `_targetOfferId` olarak orijinal teklifin ID'si verilir. Bu, kontratın otomatik eşleşme (auto-match) yapmasını sağlar.
        -   `_offeredAssets` olarak orijinal teklifin `requestedAssets`'i verilir.
        -   `_requestedAssets` olarak orijinal teklifin `offeredAssets`'i verilir.
        -   Eğer orijinal teklif "koleksiyondan herhangi bir NFT" istiyorsa, `NFTSelectionModal` ile kullanıcıdan hangi NFT'yi vereceğini seçmesi istenir.

## 6. Durum Yönetimi (State Management)

-   **TanStack Query**: Backend'den veya blockchain'den çekilen verilerin (teklifler, NFT'ler, bakiyeler) cache'lenmesi, yeniden çekilmesi ve yönetilmesi için kullanılır. `useOffers`, `useUserNFTs` gibi hook'lar `useQuery` etrafında oluşturulmuş sarmalayıcılardır. Bu, veri tutarlılığı sağlar ve gereksiz API çağrılarını önler.
-   **`useReducer`**: `CreateOfferWizard` gibi çok adımlı ve karmaşık formlarda, state geçişlerini ve güncellemelerini yönetmek için kullanılır. `createOfferReducer` fonksiyonu, tüm state değişikliklerinin mantığını içerir.

## 7. Kimlik Doğrulama (Authentication)

-   **Privy**: Cüzdan bağlantısı ve kullanıcı kimlik doğrulaması tamamen Privy SDK'sı ile yönetilir.
-   `usePrivy()` hook'u, kullanıcının giriş yapıp yapmadığını (`authenticated`), `login` ve `logout` fonksiyonlarını sağlar.
-   `useWallets()` hook'u, kullanıcının bağlı cüzdanlarının listesini ve adreslerini verir.
-   `Header.tsx` bileşeni, cüzdan bağlantı durumunu gösteren ve `login`/`logout` işlemlerini tetikleyen UI'ı içerir.

---

Bu doküman, projenin frontend katmanının temel taşlarını ve işleyiş mantığını özetlemektedir. Kodu incelerken bu rehberin yol gösterici olması hedeflenmiştir.
