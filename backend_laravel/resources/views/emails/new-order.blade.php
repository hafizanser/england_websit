@php
    $money = fn ($n) => 'Rs. ' . number_format((int) $n);
    $cust  = $order['customer'] ?? [];
    $items = $order['items'] ?? [];
    $code  = $order['code'] ?? ('#' . ($order['id'] ?? ''));
    $when  = $order['placed_at'] ?? ($order['created_at'] ?? '');
    $status = ucfirst((string) ($order['status'] ?? 'pending'));
    $source = ucfirst((string) ($order['source'] ?? 'website'));
@endphp
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>New Order {{ $code }}</title>
</head>
<body style="margin:0; padding:0; background:#f4f1ec; font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif; color:#241910;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ec; padding:24px 12px;">
        <tr>
            <td align="center">
                <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px; width:100%; background:#ffffff; border-radius:14px; overflow:hidden; box-shadow:0 6px 24px rgba(36,25,16,.08);">

                    <!-- Header -->
                    <tr>
                        <td style="background:#241910; padding:28px 32px;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td style="font-size:22px; font-weight:800; letter-spacing:.5px; color:#ffffff;">England</td>
                                    <td align="right" style="font-size:12px; color:#d8b98a; text-transform:uppercase; letter-spacing:1px;">New Order</td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Title band -->
                    <tr>
                        <td style="padding:26px 32px 6px 32px;">
                            <div style="font-size:13px; color:#8a7a66;">A new order has been placed</div>
                            <div style="font-size:26px; font-weight:800; margin-top:4px;">{{ $code }}</div>
                            <div style="margin-top:10px;">
                                <span style="display:inline-block; background:#fbeede; color:#9a5a12; font-size:12px; font-weight:700; padding:5px 12px; border-radius:999px;">{{ $status }}</span>
                                <span style="display:inline-block; background:#eef2ee; color:#3f5d44; font-size:12px; font-weight:700; padding:5px 12px; border-radius:999px; margin-left:6px;">via {{ $source }}</span>
                            </div>
                            @if($when)
                                <div style="font-size:12px; color:#8a7a66; margin-top:10px;">{{ $when }}</div>
                            @endif
                        </td>
                    </tr>

                    <!-- Customer -->
                    <tr>
                        <td style="padding:18px 32px 0 32px;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf7f2; border:1px solid #eee4d6; border-radius:10px;">
                                <tr><td style="padding:16px 18px;">
                                    <div style="font-size:11px; text-transform:uppercase; letter-spacing:1px; color:#8a7a66; margin-bottom:8px;">Customer</div>
                                    <div style="font-size:16px; font-weight:700;">{{ $cust['name'] ?? '—' }}</div>
                                    <div style="font-size:14px; color:#4a3f31; margin-top:4px;">
                                        📞 {{ $cust['phone'] ?? '—' }}
                                        @if(!empty($cust['email'])) &nbsp;•&nbsp; ✉️ {{ $cust['email'] }} @endif
                                    </div>
                                    @if(!empty($cust['address']) || !empty($cust['city']))
                                        <div style="font-size:14px; color:#4a3f31; margin-top:6px;">
                                            📍 {{ trim(($cust['address'] ?? '') . (!empty($cust['city']) ? ', ' . $cust['city'] : ''), ', ') }}
                                        </div>
                                    @endif
                                </td></tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Items -->
                    <tr>
                        <td style="padding:22px 32px 0 32px;">
                            <div style="font-size:11px; text-transform:uppercase; letter-spacing:1px; color:#8a7a66; margin-bottom:10px;">Items ({{ count($items) }})</div>
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                                <tr style="background:#241910;">
                                    <th align="left"  style="padding:10px 12px; font-size:11px; color:#d8b98a; text-transform:uppercase; letter-spacing:.5px;">Product</th>
                                    <th align="center" style="padding:10px 8px; font-size:11px; color:#d8b98a; text-transform:uppercase; letter-spacing:.5px;">Qty</th>
                                    <th align="right" style="padding:10px 8px; font-size:11px; color:#d8b98a; text-transform:uppercase; letter-spacing:.5px;">Price</th>
                                    <th align="right" style="padding:10px 12px; font-size:11px; color:#d8b98a; text-transform:uppercase; letter-spacing:.5px;">Total</th>
                                </tr>
                                @foreach($items as $it)
                                    <tr style="border-bottom:1px solid #efe7da;">
                                        <td style="padding:12px; font-size:14px;">
                                            <div style="font-weight:700;">{{ $it['name'] ?? '—' }}</div>
                                            @if(!empty($it['sub']))<div style="font-size:12px; color:#8a7a66; margin-top:2px;">{{ $it['sub'] }}</div>@endif
                                            @if(!empty($it['unit']))<div style="font-size:11px; color:#a59683; margin-top:2px;">Unit: {{ $it['unit'] }}</div>@endif
                                        </td>
                                        <td align="center" style="padding:12px 8px; font-size:14px;">{{ (int) ($it['qty'] ?? 0) }}</td>
                                        <td align="right" style="padding:12px 8px; font-size:14px;">{{ $money($it['unit_price'] ?? 0) }}</td>
                                        <td align="right" style="padding:12px; font-size:14px; font-weight:700;">{{ $money($it['net_total'] ?? ($it['line_total'] ?? 0)) }}</td>
                                    </tr>
                                @endforeach
                            </table>
                        </td>
                    </tr>

                    <!-- Totals -->
                    <tr>
                        <td style="padding:18px 32px 0 32px;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td style="font-size:14px; color:#4a3f31; padding:4px 0;">Subtotal</td>
                                    <td align="right" style="font-size:14px; padding:4px 0;">{{ $money($order['subtotal'] ?? 0) }}</td>
                                </tr>
                                @if(((int) ($order['promo_discount'] ?? 0)) > 0)
                                    <tr>
                                        <td style="font-size:14px; color:#3f5d44; padding:4px 0;">Promo discount @if(!empty($order['promo_code']))({{ $order['promo_code'] }})@endif</td>
                                        <td align="right" style="font-size:14px; color:#3f5d44; padding:4px 0;">- {{ $money($order['promo_discount'] ?? 0) }}</td>
                                    </tr>
                                @endif
                                @if(((int) ($order['item_discount'] ?? 0)) > 0)
                                    <tr>
                                        <td style="font-size:14px; color:#3f5d44; padding:4px 0;">Item discount</td>
                                        <td align="right" style="font-size:14px; color:#3f5d44; padding:4px 0;">- {{ $money($order['item_discount'] ?? 0) }}</td>
                                    </tr>
                                @endif
                                @if(((int) ($order['delivery'] ?? 0)) > 0)
                                    <tr>
                                        <td style="font-size:14px; color:#4a3f31; padding:4px 0;">Delivery</td>
                                        <td align="right" style="font-size:14px; padding:4px 0;">{{ $money($order['delivery'] ?? 0) }}</td>
                                    </tr>
                                @endif
                                <tr><td colspan="2" style="border-top:2px solid #241910; padding-top:8px;"></td></tr>
                                <tr>
                                    <td style="font-size:17px; font-weight:800; padding:4px 0;">Grand Total</td>
                                    <td align="right" style="font-size:17px; font-weight:800; color:#9a5a12; padding:4px 0;">{{ $money($order['total'] ?? 0) }}</td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    @if(!empty($order['note']))
                        <tr>
                            <td style="padding:18px 32px 0 32px;">
                                <div style="background:#fbeede; border-radius:10px; padding:14px 16px; font-size:14px; color:#7a4a14;">
                                    <strong>Note:</strong> {{ $order['note'] }}
                                </div>
                            </td>
                        </tr>
                    @endif

                    <!-- Footer -->
                    <tr>
                        <td style="padding:28px 32px 32px 32px;">
                            <div style="border-top:1px solid #efe7da; padding-top:16px; font-size:12px; color:#a59683; text-align:center;">
                                This is an automated notification from the England order system.<br>
                                Open the admin dashboard to confirm and process this order.
                            </div>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>
</body>
</html>
