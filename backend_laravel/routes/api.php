<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\BlogController;
use App\Http\Controllers\CartController;
use App\Http\Controllers\CatalogController;
use App\Http\Controllers\CheckoutController;
use App\Http\Controllers\ImageController;
use App\Http\Controllers\OrderController;
use App\Http\Controllers\ReviewController;
use App\Http\Controllers\Admin\BlogController as AdminBlogController;
use App\Http\Controllers\Admin\CategoryController as AdminCategoryController;
use App\Http\Controllers\Admin\CustomerController as AdminCustomerController;
use App\Http\Controllers\Admin\NotificationController as AdminNotificationController;
use App\Http\Controllers\Admin\OfferController as AdminOfferController;
use App\Http\Controllers\Admin\OrderController as AdminOrderController;
use App\Http\Controllers\Admin\ProductController as AdminProductController;
use App\Http\Controllers\Admin\ProfitController as AdminProfitController;
use App\Http\Controllers\Admin\ReportController as AdminReportController;
use App\Http\Controllers\Admin\ReviewController as AdminReviewController;
use Illuminate\Support\Facades\Route;

// ---- health / root --------------------------------------------------------
Route::get('/', [CatalogController::class, 'categories']);
Route::get('/api', [CatalogController::class, 'categories']);

// ---- Shared images (public) ----------------------------------------------
Route::get('/image', [ImageController::class, 'show']);

// ---- Catalog (public) -----------------------------------------------------
Route::get('/products/top-selling', [CatalogController::class, 'topSelling']);
Route::get('/products', [CatalogController::class, 'products']);
Route::get('/products/{id}/reviews', [ReviewController::class, 'index']);
Route::post('/products/{id}/reviews', [ReviewController::class, 'store']);
Route::get('/products/{id}', [CatalogController::class, 'product']);
Route::get('/categories', [CatalogController::class, 'categories']);
Route::get('/offers/featured', [CatalogController::class, 'featuredOffers']);
Route::get('/offers', [CatalogController::class, 'offers']);
Route::get('/offers/{slug}', [CatalogController::class, 'offer']);
Route::get('/blogs', [BlogController::class, 'index']);
Route::get('/blogs/{slug}', [BlogController::class, 'show']);

// ---- Reviews (public) -----------------------------------------------------
Route::get('/reviews/featured', [ReviewController::class, 'featured']);

// ---- Promo + cart pricing (public) ---------------------------------------
Route::post('/promo/validate', [CatalogController::class, 'validateCode']);
Route::post('/cart/quote', [CatalogController::class, 'quote']);

// ---- Checkout + customer orders (public) ----------------------------------
Route::post('/checkout', [CheckoutController::class, 'place']);
Route::post('/orders/lookup', [OrderController::class, 'lookup']);
Route::get('/orders/{code}', [OrderController::class, 'show']);

// ---- Customer auth --------------------------------------------------------
Route::post('/auth/customer/register', [AuthController::class, 'customerRegister']);
Route::post('/auth/customer/login', [AuthController::class, 'customerLogin']);
Route::post('/auth/customer/phone-login', [AuthController::class, 'customerPhoneLogin']);
Route::post('/auth/customer/logout', [AuthController::class, 'customerLogout']);

Route::middleware('customer.auth')->group(function () {
    Route::get('/auth/customer/me', [AuthController::class, 'customerMe']);
    Route::get('/customer/orders', [OrderController::class, 'myOrders']);

    // Saved cart (persists across logins)
    Route::get('/customer/cart', [CartController::class, 'show']);
    Route::put('/customer/cart', [CartController::class, 'save']);
    Route::post('/customer/cart', [CartController::class, 'save']);
    Route::delete('/customer/cart', [CartController::class, 'clear']);
});

// ---- Admin auth -----------------------------------------------------------
Route::post('/auth/admin/login', [AuthController::class, 'adminLogin']);
Route::post('/auth/admin/logout', [AuthController::class, 'adminLogout']);
Route::get('/auth/admin/me', [AuthController::class, 'adminMe'])->middleware('admin.auth');

// ---- Admin (token-guarded) -----------------------------------------------
Route::middleware('admin.auth')->group(function () {
    // orders
    Route::get('/admin/orders', [AdminOrderController::class, 'index']);
    Route::post('/admin/orders', [AdminOrderController::class, 'store']);
    Route::get('/admin/orders/{id}', [AdminOrderController::class, 'show']);
    Route::patch('/admin/orders/{id}/status', [AdminOrderController::class, 'updateStatus']);
    Route::patch('/admin/orders/{id}/items/{item}/discount', [AdminOrderController::class, 'setItemDiscount']);

    // customers
    Route::get('/admin/customers', [AdminCustomerController::class, 'index']);
    Route::post('/admin/customers', [AdminCustomerController::class, 'store']);
    Route::get('/admin/customers/{id}', [AdminCustomerController::class, 'show']);
    Route::put('/admin/customers/{id}', [AdminCustomerController::class, 'update']);
    Route::delete('/admin/customers/{id}', [AdminCustomerController::class, 'destroy']);

    // profit (PIN-gated inside the controller)
    Route::post('/admin/profit/verify', [AdminProfitController::class, 'verify']);
    Route::get('/admin/profit/orders', [AdminProfitController::class, 'orders']);
    Route::get('/admin/profit/orders/{id}', [AdminProfitController::class, 'orderDetail']);
    Route::get('/admin/profit', [AdminProfitController::class, 'index']);

    // products
    Route::get('/admin/products', [AdminProductController::class, 'index']);
    Route::post('/admin/products', [AdminProductController::class, 'store']);
    Route::get('/admin/products/{id}', [AdminProductController::class, 'show']);
    Route::post('/admin/products/{id}', [AdminProductController::class, 'update']); // multipart updates
    Route::put('/admin/products/{id}', [AdminProductController::class, 'update']);
    Route::delete('/admin/products/{id}', [AdminProductController::class, 'destroy']);

    // categories
    Route::get('/admin/categories', [AdminCategoryController::class, 'index']);
    Route::post('/admin/categories', [AdminCategoryController::class, 'store']);
    Route::post('/admin/categories/{id}', [AdminCategoryController::class, 'update']);
    Route::put('/admin/categories/{id}', [AdminCategoryController::class, 'update']);
    Route::delete('/admin/categories/{id}', [AdminCategoryController::class, 'destroy']);

    // offers
    Route::get('/admin/offers', [AdminOfferController::class, 'index']);
    Route::post('/admin/offers', [AdminOfferController::class, 'store']);
    Route::post('/admin/offers/{id}', [AdminOfferController::class, 'update']); // multipart updates
    Route::put('/admin/offers/{id}', [AdminOfferController::class, 'update']);
    Route::delete('/admin/offers/{id}', [AdminOfferController::class, 'destroy']);

    // reporting
    Route::get('/admin/reports/summary', [AdminReportController::class, 'summary']);

    // reviews + notifications
    Route::get('/admin/reviews', [AdminReviewController::class, 'index']);
    Route::post('/admin/reviews/{id}', [AdminReviewController::class, 'update']);
    Route::put('/admin/reviews/{id}', [AdminReviewController::class, 'update']);
    Route::delete('/admin/reviews/{id}', [AdminReviewController::class, 'destroy']);
    Route::get('/admin/notifications', [AdminNotificationController::class, 'index']);

    // blog
    Route::get('/admin/blogs', [AdminBlogController::class, 'index']);
    Route::post('/admin/blogs', [AdminBlogController::class, 'store']);
    Route::get('/admin/blogs/{id}', [AdminBlogController::class, 'show']);
    Route::post('/admin/blogs/{id}', [AdminBlogController::class, 'update']); // multipart updates
    Route::put('/admin/blogs/{id}', [AdminBlogController::class, 'update']);
    Route::delete('/admin/blogs/{id}', [AdminBlogController::class, 'destroy']);
});
