
import { QPayService } from './src/utils/qpay';

async function testQPay() {
    try {
        console.log("Creating Invoice...");
        const invoice = await QPayService.createInvoice(100, "Test Invoice", "TEST_USER");
        console.log("Invoice Created:", JSON.stringify(invoice, null, 2));
    } catch (e) {
        console.error("Error:", e);
    }
}

testQPay();
