const STORAGE_KEY = "flop-ui-language";

const translations = {
  en: {
    app_name: "FLOP Capability Lab",
    hero: "Your agent says what it can do. We test it.",
    identify: "Identify",
    choose_control: "Choose how this agent identity is controlled.",
    not_custodian: "FLOP is not a private-key custodian.",
    create_title: "Create browser-owned DID",
    create_desc: "FLOP creates an Ed25519 identity in this browser. The active key becomes nonextractable. You keep an encrypted recovery file.",
    backup_passphrase: "Backup passphrase",
    passphrase_min: "At least 10 characters",
    create_button: "Create identity + encrypted backup",
    restore_title: "Restore browser-owned DID",
    restore_desc: "Restore from a FLOP encrypted identity backup. The decrypted private key stays in this browser and is re-imported as nonextractable.",
    encrypted_backup_file: "Encrypted backup file",
    choose_backup_file: "Choose backup file",
    no_file_selected: "No file selected",
    restore_button: "Restore identity",
    connect_title: "Connect existing DID",
    connect_desc: "Use an Ed25519 did:key controlled by another wallet, agent or signer. FLOP stores only the public DID. Control is proven when its signer signs the trial submission.",
    existing_did: "Existing DID",
    connect_button: "Connect existing DID",
    run_trial: "Run Ed25519 trial",
    show_private_key: "Show my private key",
    private_key_title: "Your private key",
    private_key_desc: "Enter your backup passphrase. The key is decrypted only in this browser.",
    reveal_private_key: "Reveal private key",
    private_key_value: "Private key",
    copy_private_key: "Copy private key",
    hide_private_key: "Hide private key",
    private_key_warning: "Anyone with this key controls this DID. Keep it private.",
    private_key_revealed: "Private key revealed locally. It was not sent to FLOP.",
    private_key_copied: "Private key copied.",
    download_backup: "Download encrypted backup",
    disconnect: "Disconnect local identity",
    external_signer: "External signer",
    external_signer_desc: "Sign this exact canonical payload with the private key for the connected DID.",
    external_signature: "Ed25519 signature, base64url",
    external_signature_placeholder: "Signature from your wallet / agent / signer",
    submit_signed_result: "Submit signed result",
    cancel: "Cancel",
    server_evidence: "Server evidence",
    waiting_identity: "Waiting for identity…",
    no_evidence: "No verified capability evidence yet.",
    durable_evidence: "Durable server evidence recovered.",
    open_receipt: "Open latest verified receipt",
    custody_checks: "Custody checks",
    identity_mode: "Identity mode",
    private_exportable: "Private key exportable",
    encrypted_recovery: "Encrypted recovery backup",
    network_transfer: "Private key network transfer",
    never: "never",
    none: "none",
    browser_owned: "browser-owned",
    external_signer_mode: "external signer",
    not_held: "not held by FLOP",
    owned_externally: "owned externally",
    encrypted_ready: "encrypted · ready",
    missing_legacy: "missing · legacy identity",
    browser_ready: "Browser-owned identity ready.",
    browser_custody: "Active signing key is a nonextractable CryptoKey in IndexedDB. Recovery is an encrypted portable backup.",
    existing_connected: "Existing DID connected.",
    external_custody: "FLOP holds no private key for this DID. Control is proven only by a valid signed submission from its external signer.",
    op_create: "Creating browser-owned Ed25519 identity and encrypted backup…",
    op_created: "Identity created. Encrypted recovery backup downloaded. Keep that file and its passphrase separately.",
    op_restore: "Decrypting backup locally and restoring a nonextractable active key…",
    op_restored: "Identity restored locally. The active private key is nonextractable.",
    err_choose_backup: "Choose an encrypted FLOP identity backup first.",
    op_connected: "Existing DID connected. FLOP has no private key. Run a trial to prove control with your external signer.",
    err_identity_first: "Connect or create an identity first.",
    op_challenge: "Creating DID-bound challenge…",
    op_external_ready: "Challenge ready. Sign the exact canonical payload with the external DID signer, then paste its base64url Ed25519 signature.",
    op_submitting: "Submitting browser-signed result…",
    op_pass: "PASS. Receipt persisted on Railway and is publicly verifiable.",
    err_no_external: "No external signing request is pending.",
    err_signature_length: "Ed25519 signature must decode to 64 bytes.",
    err_signature_control: "Signature does not prove control of the connected DID for this exact payload.",
    op_external_valid: "External DID signature is valid locally. Submitting to Capability Lab…",
    op_external_pass: "PASS. External DID control was proven by signature; FLOP never received its private key.",
    op_disconnected: "Local identity connection removed. No server-side private key existed to delete.",
    op_recovered: "Identity recovered from this browser.",
    passes: "passes",
    verify_title: "Receipt verification",
    receipt_signature: "Receipt signature",
    checking: "CHECKING",
    valid: "VALID",
    invalid: "INVALID",
    unavailable: "UNAVAILABLE",
    verify_note: "This page independently verifies the server-signed receipt in this browser using the public Ed25519 key published by the Railway API.",
    receipt_id: "Receipt ID",
    agent_did: "Agent DID",
    capability: "Capability",
    trial: "Trial",
    trial_version: "Trial version",
    verifier: "Verifier",
    verifier_version: "Verifier version",
    verdict: "Verdict",
    evidence_type: "Evidence type",
    challenge_hash: "Challenge hash",
    result_hash: "Result hash",
    issued_at: "Issued at",
    server_key_id: "Server key ID",
    server_key_status: "Server key status",
  },
  tr: {
    app_name: "FLOP Capability Lab",
    hero: "Ajanın ne yapabildiğini söylüyor. Biz test ediyoruz.",
    identify: "Kimlik",
    choose_control: "Bu ajan kimliğinin nasıl kontrol edildiğini seç.",
    not_custodian: "FLOP private key saklamaz.",
    create_title: "Tarayıcıya ait DID oluştur",
    create_desc: "FLOP bu tarayıcıda bir Ed25519 kimliği oluşturur. Aktif anahtar dışarı aktarılamaz hale gelir. Şifrelenmiş kurtarma dosyası sende kalır.",
    backup_passphrase: "Yedekleme parolası",
    passphrase_min: "En az 10 karakter",
    create_button: "Kimlik oluştur + şifreli yedek indir",
    restore_title: "Tarayıcıya ait DID'yi geri yükle",
    restore_desc: "FLOP şifreli kimlik yedeğinden geri yükle. Çözülen private key bu tarayıcıda kalır ve tekrar dışarı aktarılamaz olarak içe alınır.",
    encrypted_backup_file: "Şifreli yedek dosyası",
    choose_backup_file: "Yedek dosyası seç",
    no_file_selected: "Dosya seçilmedi",
    restore_button: "Kimliği geri yükle",
    connect_title: "Mevcut DID bağla",
    connect_desc: "Başka bir wallet, ajan veya signer tarafından kontrol edilen Ed25519 did:key kullan. FLOP yalnızca public DID'yi tutar. Kontrol, signer trial submission'ını imzaladığında kanıtlanır.",
    existing_did: "Mevcut DID",
    connect_button: "Mevcut DID'yi bağla",
    run_trial: "Ed25519 trial çalıştır",
    show_private_key: "Private key'imi göster",
    private_key_title: "Private key'in",
    private_key_desc: "Yedekleme parolanı gir. Private key yalnızca bu tarayıcıda çözülür.",
    reveal_private_key: "Private key'i göster",
    private_key_value: "Private key",
    copy_private_key: "Private key'i kopyala",
    hide_private_key: "Private key'i gizle",
    private_key_warning: "Bu key'e sahip olan kişi bu DID'yi kontrol eder. Gizli tut.",
    private_key_revealed: "Private key yalnızca bu cihazda açıldı. FLOP'a gönderilmedi.",
    private_key_copied: "Private key kopyalandı.",
    download_backup: "Şifreli yedeği indir",
    disconnect: "Yerel kimlik bağlantısını kaldır",
    external_signer: "Harici signer",
    external_signer_desc: "Bu canonical payload'ı bağlı DID'nin private key'i ile birebir imzala.",
    external_signature: "Ed25519 signature, base64url",
    external_signature_placeholder: "Wallet / ajan / signer tarafından üretilen signature",
    submit_signed_result: "İmzalı sonucu gönder",
    cancel: "İptal",
    server_evidence: "Sunucu kanıtı",
    waiting_identity: "Kimlik bekleniyor…",
    no_evidence: "Henüz doğrulanmış capability kanıtı yok.",
    durable_evidence: "Kalıcı sunucu kanıtı geri getirildi.",
    open_receipt: "Son doğrulanmış receipt'i aç",
    custody_checks: "Custody kontrolleri",
    identity_mode: "Kimlik modu",
    private_exportable: "Private key dışarı aktarılabilir",
    encrypted_recovery: "Şifreli kurtarma yedeği",
    network_transfer: "Private key ağ üzerinden aktarımı",
    never: "asla",
    none: "yok",
    browser_owned: "tarayıcıya ait",
    external_signer_mode: "harici signer",
    not_held: "FLOP'ta tutulmuyor",
    owned_externally: "harici olarak sahipleniliyor",
    encrypted_ready: "şifreli · hazır",
    missing_legacy: "eksik · eski kimlik",
    browser_ready: "Tarayıcıya ait kimlik hazır.",
    browser_custody: "Aktif signing key IndexedDB içinde dışarı aktarılamayan bir CryptoKey. Kurtarma için şifrelenmiş taşınabilir yedek kullanılır.",
    existing_connected: "Mevcut DID bağlandı.",
    external_custody: "FLOP bu DID için private key tutmaz. Kontrol yalnızca harici signer'ın geçerli imzalı submission'ı ile kanıtlanır.",
    op_create: "Tarayıcıya ait Ed25519 kimliği ve şifreli yedek oluşturuluyor…",
    op_created: "Kimlik oluşturuldu. Şifreli kurtarma yedeği indirildi. Dosyayı ve parolasını ayrı yerlerde güvenle sakla.",
    op_restore: "Yedek yerel olarak çözülüyor ve dışarı aktarılamayan aktif key geri yükleniyor…",
    op_restored: "Kimlik yerel olarak geri yüklendi. Aktif private key dışarı aktarılamaz.",
    err_choose_backup: "Önce şifreli FLOP kimlik yedeğini seç.",
    op_connected: "Mevcut DID bağlandı. FLOP'ta private key yok. Kontrolü kanıtlamak için trial çalıştır ve harici signer ile imzala.",
    err_identity_first: "Önce bir kimlik oluştur veya mevcut DID bağla.",
    op_challenge: "DID'ye bağlı challenge oluşturuluyor…",
    op_external_ready: "Challenge hazır. Canonical payload'ı harici DID signer ile birebir imzala, sonra base64url Ed25519 signature'ı yapıştır.",
    op_submitting: "Tarayıcıda imzalanan sonuç gönderiliyor…",
    op_pass: "PASS. Receipt Railway'de kalıcı olarak saklandı ve herkese açık doğrulanabilir.",
    err_no_external: "Bekleyen bir harici imzalama isteği yok.",
    err_signature_length: "Ed25519 signature 64 byte olarak decode edilmelidir.",
    err_signature_control: "Bu signature bağlı DID'nin bu payload üzerindeki kontrolünü kanıtlamıyor.",
    op_external_valid: "Harici DID signature'ı yerel olarak geçerli. Capability Lab'e gönderiliyor…",
    op_external_pass: "PASS. Harici DID kontrolü signature ile kanıtlandı; FLOP private key'i hiç almadı.",
    op_disconnected: "Yerel kimlik bağlantısı kaldırıldı. Sunucuda silinecek bir private key zaten yoktu.",
    op_recovered: "Kimlik bu tarayıcıdan geri getirildi.",
    passes: "başarılı trial",
    verify_title: "Receipt doğrulama",
    receipt_signature: "Receipt signature",
    checking: "KONTROL EDİLİYOR",
    valid: "GEÇERLİ",
    invalid: "GEÇERSİZ",
    unavailable: "ERİŞİLEMİYOR",
    verify_note: "Bu sayfa, Railway API'nin yayınladığı public Ed25519 key'i kullanarak sunucu imzalı receipt'i bu tarayıcıda bağımsız olarak doğrular.",
    receipt_id: "Receipt ID",
    agent_did: "Agent DID",
    capability: "Capability",
    trial: "Trial",
    trial_version: "Trial sürümü",
    verifier: "Verifier",
    verifier_version: "Verifier sürümü",
    verdict: "Sonuç",
    evidence_type: "Kanıt türü",
    challenge_hash: "Challenge hash",
    result_hash: "Result hash",
    issued_at: "Oluşturulma zamanı",
    server_key_id: "Sunucu key ID",
    server_key_status: "Sunucu key durumu",
  },
};

let currentLanguage = null;
const listeners = new Set();

export function getLanguage() {
  if (currentLanguage) return currentLanguage;
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === "tr" || saved === "en") currentLanguage = saved;
  else currentLanguage = navigator.language.toLowerCase().startsWith("tr") ? "tr" : "en";
  return currentLanguage;
}

export function t(key) {
  const lang = getLanguage();
  return translations[lang][key] ?? translations.en[key] ?? key;
}

export function applyTranslations(root = document) {
  const lang = getLanguage();
  document.documentElement.lang = lang;
  for (const node of root.querySelectorAll("[data-i18n]")) node.textContent = t(node.dataset.i18n);
  for (const node of root.querySelectorAll("[data-i18n-placeholder]")) node.setAttribute("placeholder", t(node.dataset.i18nPlaceholder));
  for (const button of root.querySelectorAll("[data-lang]")) {
    const active = button.dataset.lang === lang;
    button.setAttribute("aria-pressed", active ? "true" : "false");
    button.classList.toggle("active", active);
  }
}

export function setLanguage(lang) {
  if (lang !== "tr" && lang !== "en") return;
  currentLanguage = lang;
  localStorage.setItem(STORAGE_KEY, lang);
  applyTranslations();
  for (const listener of listeners) listener(lang);
}

export function bindLanguageControls() {
  applyTranslations();
  for (const button of document.querySelectorAll("[data-lang]")) {
    button.addEventListener("click", () => setLanguage(button.dataset.lang));
  }
}

export function onLanguageChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
