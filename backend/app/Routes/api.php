<?php
declare(strict_types=1);

use App\Core\Router;
use App\Controllers\CatalogController;
use App\Controllers\BlogController;
use App\Controllers\UploadController;
use App\Controllers\CheckoutController;
use App\Controllers\OrderController;
use App\Controllers\CartController;
use App\Controllers\ReviewController;
use App\Controllers\AuthController;
use App\Controllers\Admin\ReviewController as AdminReviewController;
use App\Controllers\Admin\NotificationController as AdminNotificationController;
use App\Controllers\Admin\OrderController as AdminOrderController;
use App\Controllers\Admin\CustomerController as AdminCustomerController;
use App\Controllers\Admin\ProductController as AdminProductController;
use App\Controllers\Admin\CategoryController as AdminCategoryController;
use App\Controllers\Admin\OfferController as AdminOfferController;
use App\Controllers\Admin\BlogController as AdminBlogController;
use App\Controllers\Admin\ReportController as AdminReportController;
use App\Controllers\Admin\ProfitController as AdminProfitController;

return function (Router $r): void {
    // health / root
    $r->get('/', [CatalogController::class, 'categories']);
    $r->get('/api', [CatalogController::class, 'categories']);

    // ---- Shared product/category images (public) --------------------------
    // Served via query param (?file=) so the path carries no file extension —
    // keeps the php -S built-in server from mis-routing dotted paths.
    $r->get('/image', [UploadController::class, 'show']);

    // ---- Catalog (public) -------------------------------------------------
    $r->get('/products/top-selling', [CatalogController::class, 'topSelling']);
    $r->get('/products', [CatalogController::class, 'products']);
    $r->get('/products/{id}', [CatalogController::class, 'product']);
    $r->get('/categories', [CatalogController::class, 'categories']);
    $r->get('/offers/featured', [CatalogController::class, 'featuredOffers']);
    $r->get('/offers', [CatalogController::class, 'offers']);
    $r->get('/offers/{slug}', [CatalogController::class, 'offer']);
    $r->get('/blogs', [BlogController::class, 'index']);
    $r->get('/blogs/{slug}', [BlogController::class, 'show']);

    // ---- Product reviews (public read + open write, no login needed) ------
    $r->get('/reviews/featured', [ReviewController::class, 'featured']);
    $r->get('/products/{id}/reviews', [ReviewController::class, 'index']);
    $r->post('/products/{id}/reviews', [ReviewController::class, 'store']);
    $r->post('/promo/validate', [CatalogController::class, 'validateCode']);
    $r->post('/cart/quote', [CatalogController::class, 'quote']);

    // ---- Checkout + customer orders (public) ------------------------------
    $r->post('/checkout', [CheckoutController::class, 'place']);
    $r->post('/orders/lookup', [OrderController::class, 'lookup']);
    $r->get('/orders/{code}', [OrderController::class, 'show']);

    // ---- Customer accounts ------------------------------------------------
    $r->post('/auth/customer/register', [AuthController::class, 'customerRegister']);
    $r->post('/auth/customer/login', [AuthController::class, 'customerLogin']);
    $r->post('/auth/customer/phone-login', [AuthController::class, 'customerPhoneLogin']);
    $r->post('/auth/customer/logout', [AuthController::class, 'customerLogout']);
    $r->get('/auth/customer/me', [AuthController::class, 'customerMe']);
    $r->get('/customer/orders', [OrderController::class, 'myOrders']);

    // ---- Customer saved cart (persists across logins) ---------------------
    $r->get('/customer/cart', [CartController::class, 'show']);
    $r->put('/customer/cart', [CartController::class, 'save']);
    $r->post('/customer/cart', [CartController::class, 'save']);
    $r->delete('/customer/cart', [CartController::class, 'clear']);

    // ---- Auth -------------------------------------------------------------
    $r->post('/auth/admin/login', [AuthController::class, 'adminLogin']);
    $r->post('/auth/admin/logout', [AuthController::class, 'adminLogout']);
    $r->get('/auth/admin/me', [AuthController::class, 'adminMe']);

    // ---- Admin: orders ----------------------------------------------------
    $r->get('/admin/orders', [AdminOrderController::class, 'index']);
    $r->post('/admin/orders', [AdminOrderController::class, 'store']);
    $r->get('/admin/orders/{id}', [AdminOrderController::class, 'show']);
    $r->patch('/admin/orders/{id}/status', [AdminOrderController::class, 'updateStatus']);
    $r->patch('/admin/orders/{id}/items/{item}/discount', [AdminOrderController::class, 'setItemDiscount']);

    // ---- Admin: customers -------------------------------------------------
    $r->get('/admin/customers', [AdminCustomerController::class, 'index']);
    $r->post('/admin/customers', [AdminCustomerController::class, 'store']);
    $r->get('/admin/customers/{id}', [AdminCustomerController::class, 'show']);
    $r->put('/admin/customers/{id}', [AdminCustomerController::class, 'update']);
    $r->delete('/admin/customers/{id}', [AdminCustomerController::class, 'destroy']);

    // ---- Admin: profit breakdown (PIN-gated) ------------------------------
    $r->post('/admin/profit/verify', [AdminProfitController::class, 'verify']);
    // Order-level profit analytics (list + per-order breakdown).
    $r->get('/admin/profit/orders', [AdminProfitController::class, 'orders']);
    $r->get('/admin/profit/orders/{id}', [AdminProfitController::class, 'orderDetail']);
    $r->get('/admin/profit', [AdminProfitController::class, 'index']);

    // ---- Admin: catalogue management -------------------------------------
    $r->get('/admin/products', [AdminProductController::class, 'index']);
    $r->post('/admin/products', [AdminProductController::class, 'store']);
    $r->get('/admin/products/{id}', [AdminProductController::class, 'show']);
    // POST update too: PHP only parses multipart (image) bodies on POST, not PUT.
    $r->post('/admin/products/{id}', [AdminProductController::class, 'update']);
    $r->put('/admin/products/{id}', [AdminProductController::class, 'update']);
    $r->delete('/admin/products/{id}', [AdminProductController::class, 'destroy']);

    $r->get('/admin/categories', [AdminCategoryController::class, 'index']);
    $r->post('/admin/categories', [AdminCategoryController::class, 'store']);
    $r->post('/admin/categories/{id}', [AdminCategoryController::class, 'update']);
    $r->put('/admin/categories/{id}', [AdminCategoryController::class, 'update']);
    $r->delete('/admin/categories/{id}', [AdminCategoryController::class, 'destroy']);

    $r->get('/admin/offers', [AdminOfferController::class, 'index']);
    $r->post('/admin/offers', [AdminOfferController::class, 'store']);
    // POST update too: PHP only parses multipart (banner) bodies on POST, not PUT.
    $r->post('/admin/offers/{id}', [AdminOfferController::class, 'update']);
    $r->put('/admin/offers/{id}', [AdminOfferController::class, 'update']);
    $r->delete('/admin/offers/{id}', [AdminOfferController::class, 'destroy']);

    // ---- Admin: reporting -------------------------------------------------
    $r->get('/admin/reports/summary', [AdminReportController::class, 'summary']);

    // ---- Admin: reviews + notifications -----------------------------------
    $r->get('/admin/reviews', [AdminReviewController::class, 'index']);
    $r->post('/admin/reviews/{id}', [AdminReviewController::class, 'update']);
    $r->put('/admin/reviews/{id}', [AdminReviewController::class, 'update']);
    $r->delete('/admin/reviews/{id}', [AdminReviewController::class, 'destroy']);
    $r->get('/admin/notifications', [AdminNotificationController::class, 'index']);

    // ---- Admin: blog -----------------------------------------------------
    $r->get('/admin/blogs', [AdminBlogController::class, 'index']);
    $r->post('/admin/blogs', [AdminBlogController::class, 'store']);
    $r->get('/admin/blogs/{id}', [AdminBlogController::class, 'show']);
    // POST update too: PHP only parses multipart (image) bodies on POST, not PUT.
    $r->post('/admin/blogs/{id}', [AdminBlogController::class, 'update']);
    $r->put('/admin/blogs/{id}', [AdminBlogController::class, 'update']);
    $r->delete('/admin/blogs/{id}', [AdminBlogController::class, 'destroy']);
};
