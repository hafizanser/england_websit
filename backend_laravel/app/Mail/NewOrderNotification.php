<?php

declare(strict_types=1);

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * Admin notification email sent when a customer places an order.
 * Receives the full order detail array (order + customer + items + totals).
 */
class NewOrderNotification extends Mailable
{
    use Queueable, SerializesModels;

    public array $order;

    public function __construct(array $order)
    {
        $this->order = $order;
    }

    public function envelope(): Envelope
    {
        $code = $this->order['code'] ?? ('#' . ($this->order['id'] ?? ''));

        return new Envelope(
            subject: 'New Order ' . $code . ' — England',
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.new-order',
            with: ['order' => $this->order],
        );
    }
}
