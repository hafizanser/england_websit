<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Support\PdfStorage;
use Illuminate\Http\Request;

/** Streams PDF documents. */
class PdfController extends Controller
{
    public function show(Request $request)
    {
        $name = basename(rawurldecode((string) $request->query('file', '')));
        $path = PdfStorage::dir() . '/' . $name;

        if ($name === '' || !is_file($path)) {
            return response('PDF not found', 404)->header('Content-Type', 'text/plain');
        }

        return response()->file($path, [
            'Content-Type'  => PdfStorage::MIME['pdf'],
            'Cache-Control' => 'public, max-age=86400',
            'Content-Disposition' => 'inline; filename="' . $name . '"',
        ]);
    }
}
