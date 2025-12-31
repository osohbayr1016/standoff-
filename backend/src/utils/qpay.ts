
export class QPayService {
    private static baseUrl = 'https://merchant.qpay.mn/v2';
    // Credentials provided by user
    private static username = 'STANDOFF_FACEIT';
    private static password = 'Efxa8Ceq';
    private static invoiceCode = 'STANDOFF_FACEIT_INVOICE';

    private static accessToken: string | null = null;
    private static tokenExpiresAt: number = 0;

    private static async getAccessToken(): Promise<string> {
        // Return existing token if valid (buffer 5 minutes)
        if (this.accessToken && Date.now() < this.tokenExpiresAt - 300000) {
            return this.accessToken;
        }

        try {
            const authStr = btoa(`${this.username}:${this.password}`);
            const res = await fetch(`${this.baseUrl}/auth/token`, {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${authStr}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!res.ok) {
                const text = await res.text();
                throw new Error(`QPay Auth Failed: ${res.status} ${text}`);
            }

            const data = await res.json() as any;
            this.accessToken = data.access_token;
            // Decode jwt to find exp or just use a default valid time (e.g. 24h usually, but safe to assume 1h)
            // For safety, let's assume it's valid for 1 hour if not specified, but usually response has it?
            // QPay response typically is { access_token, token_type, refresh_token, ... }
            // Let's set expire time to 1 hour from now for safety/simplicity
            this.tokenExpiresAt = Date.now() + 3600 * 1000;

            return this.accessToken as string;
        } catch (error) {
            console.error('QPay Token Error:', error);
            throw error;
        }
    }

    static async createInvoice(amount: number, description: string, senderId: string) {
        try {
            const token = await this.getAccessToken();

            const payload = {
                invoice_code: this.invoiceCode,
                sender_invoice_no: `SF-${senderId}-${Date.now()}`,
                invoice_receiver_code: this.invoiceCode, // Using invoice code as terminal/receiver code if not specified, or we could use 'terminal'
                invoice_description: description,
                amount: amount,
                callback_url: 'https://backend.standoff.example.com/api/qpay/callback',
                lines: [
                    {
                        line_description: description,
                        line_quantity: "1.00",
                        line_unit_price: amount.toString()
                    }
                ]
            };

            const res = await fetch(`${this.baseUrl}/invoice`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const text = await res.text();
                throw new Error(`QPay Invoice Failed: ${res.status} ${text}`);
            }

            const data = await res.json() as any;
            // QPay returns: { invoice_id, qr_text, qr_image, urls: [{name, link, logo}, ...] }
            return {
                invoice_id: data.invoice_id,
                qr_text: data.qr_text,
                qr_image: data.qr_image,
                urls: data.urls || []
            };
        } catch (error) {
            console.error('QPay Create Invoice Error:', error);
            throw error;
        }
    }

    static async checkInvoice(invoiceId: string) {
        try {
            const token = await this.getAccessToken();

            const res = await fetch(`${this.baseUrl}/payment/check`, {
                method: 'POST', // QPay verify uses POST usually
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    object_type: "INVOICE",
                    object_id: invoiceId
                })
            });

            if (!res.ok) {
                // Should we throw or return failure?
                const text = await res.text();
                console.error('QPay Check Failed:', text);
                throw new Error(`QPay Check Failed: ${res.status}`);
            }

            const data = await res.json() as any;
            // data.rows usually contains payment info if paid
            // Structure depends on QPay version, but typically checks 'count' or 'rows'
            const isPaid = data.count > 0 && data.rows.some((row: any) => row.payment_status === 'PAID');

            return isPaid;
        } catch (error) {
            console.error('QPay Check Error:', error);
            throw error;
        }
    }
}
