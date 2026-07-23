<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Core\Controller;
use App\Core\PdfStorage;

class PdfController extends Controller
{
    public function index(): void
    {
        $name = basename(rawurldecode((string)$this->request->get('file', '')));
        $path = PdfStorage::dir() . '/' . $name;

        if ($name === '' || !is_file($path)) {
            header('HTTP/1.1 404 Not Found');
            echo 'PDF not found';
            return;
        }

        header('Content-Type: application/pdf');
        header('Cache-Control: public, max-age=86400');
        header('Content-Disposition: inline; filename="' . $name . '"');
        readfile($path);
    }
}
