<?php
/**
 * One-time seeder: 10 realistic approved customer reviews in the shared
 * order_system MySQL `reviews` table. Idempotent — re-running skips reviews
 * that already exist (matched by name + comment).
 *
 * Run:  D:\xamp\php\php.exe backend/database/seed_reviews.php
 */
declare(strict_types=1);

$config = require __DIR__ . '/../config/config.php';
$cfg = $config['mysql'] ?? [];

try {
    $dsn = sprintf(
        'mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4',
        $cfg['host'] ?? '127.0.0.1',
        $cfg['port'] ?? '3306',
        $cfg['database'] ?? 'order_system'
    );
    $pdo = new PDO($dsn, $cfg['username'] ?? 'root', $cfg['password'] ?? '', [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
} catch (Throwable $e) {
    fwrite(STDERR, "Cannot connect to MySQL (order_system). Is XAMPP MySQL running?\n  " . $e->getMessage() . "\n");
    exit(1);
}

// Safety net: ensure the reviews table exists with the expected shape.
$pdo->exec(
    "CREATE TABLE IF NOT EXISTS reviews (
        id           INT AUTO_INCREMENT PRIMARY KEY,
        product_id   INT NOT NULL,
        customer_name VARCHAR(150) NOT NULL DEFAULT 'Customer',
        customer_id  INT NULL,
        rating       TINYINT NOT NULL DEFAULT 5,
        comment      TEXT,
        status       VARCHAR(20) NOT NULL DEFAULT 'approved',
        is_moderated TINYINT NOT NULL DEFAULT 0,
        approved_at  DATETIME NULL,
        created_at   DATETIME NULL,
        updated_at   DATETIME NULL,
        INDEX idx_reviews_product (product_id),
        INDEX idx_reviews_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
);

// Attach reviews to real, active products so the admin join shows product names.
$pids = $pdo->query("SELECT id FROM tbl_product WHERE is_active = 1 ORDER BY id ASC LIMIT 10")->fetchAll(PDO::FETCH_COLUMN);
if (!$pids) {
    $pids = $pdo->query("SELECT id FROM tbl_product ORDER BY id ASC LIMIT 10")->fetchAll(PDO::FETCH_COLUMN);
}
if (!$pids) {
    fwrite(STDERR, "No products found in tbl_product — add products first, then re-run.\n");
    exit(1);
}

// 10 authentic Pakistani shopkeeper reviews (Roman Urdu).
$reviews = [
    ['Muhammad Aslam',  5, 'Maal hamesha asli aur time par milta hai. England ke rates poori market mein sab se behtar hain — meri dukaan ka pakka partner.'],
    ['Bilal Ahmed',     5, 'Agle din delivery ne kaam asaan kar diya. Ab mandi ke chakkar khatam, dukaan band karne ki zaroorat hi nahi rehti.'],
    ['Haji Yousuf',     5, 'Bees saal se dukaan chala raha hoon, itni saaf service pehli dafa dekhi. Margin bhi acha milta hai aur customer khush.'],
    ['Imran Shahzad',   4, 'WhatsApp par order bhejo aur kaam khatam. Staff bohat cooperative hai, masla foran hal kar dete hain.'],
    ['Abdul Rehman',    5, 'Quality ka koi muqabla nahi. Customer baar baar wahi maal maangte hain, isliye stock kabhi rukta nahi.'],
    ['Naveed Akhtar',   5, 'Rates fixed hain, koi bargaining ka jhanjhat nahi. Har hafte fresh stock dukaan par pohanch jata hai.'],
    ['Shahid Mehmood',  4, 'Free delivery ne acha khasa paisa bacha diya. Main har naye dukaandar ko England recommend karta hoon.'],
    ['Tariq Javed',     5, 'Packing itni achi hoti hai ke aaj tak kuch kharab nahi nikla. Bharose ka naam hai England.'],
    ['Zahid Hussain',   5, 'Order karne ke baad fikar khatam — maal waqt par seedha dukaan par. Bilkul professional service.'],
    ['Kamran Ali',      5, 'Naye dukaandaron ke liye behtareen partner. Support team hamesha available hoti hai aur rehnumai karti hai.'],
];

$exists = $pdo->prepare('SELECT 1 FROM reviews WHERE customer_name = ? AND comment = ? LIMIT 1');
$ins = $pdo->prepare(
    "INSERT INTO reviews (product_id, customer_name, customer_id, rating, comment, status, is_moderated, approved_at, created_at, updated_at)
     VALUES (?, ?, NULL, ?, ?, 'approved', 1, NOW(), ?, NOW())"
);

$added = 0;
foreach ($reviews as $i => [$name, $rating, $comment]) {
    $exists->execute([$name, $comment]);
    if ($exists->fetchColumn()) {
        continue;
    }
    $pid = (int)$pids[$i % count($pids)];
    $created = date('Y-m-d H:i:s', time() - ($i * 86400)); // stagger so order looks natural
    $ins->execute([$pid, $name, $rating, $comment, $created]);
    $added++;
}

echo "Seeded {$added} review(s); skipped " . (count($reviews) - $added) . " existing.\n";
