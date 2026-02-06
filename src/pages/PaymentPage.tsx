import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { formatCurrency } from '../utils/formatters';
import { Shield, CheckCircle, CreditCard } from 'lucide-react';

interface OrderDetails {
    id: string;
    order_no: string;
    grand_total: number;
    shipping_address: any;
    guest_name?: string;
    guest_email?: string;
    guest_phone?: string;
    items: any[];
}

const PaymentPage: React.FC = () => {
    const { orderId } = useParams<{ orderId: string }>();
    const navigate = useNavigate();

    const [order, setOrder] = useState<OrderDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [agreementChecked, setAgreementChecked] = useState(false);

    // Credit Card State
    const [cardName, setCardName] = useState('');
    const [cardNumber, setCardNumber] = useState('');
    const [cardExpiry, setCardExpiry] = useState('');
    const [cardCvc, setCardCvc] = useState('');

    // UI State
    const [formError, setFormError] = useState<string | null>(null);

    useEffect(() => {
        fetchOrderDetails();
    }, [orderId]);

    const fetchOrderDetails = async () => {
        if (!orderId) return;

        try {
            const { data: orderData, error } = await supabase
                .from('orders')
                .select(`
                    id,
                    order_no,
                    grand_total,
                    shipping_address,
                    guest_name,
                    guest_email,
                    guest_phone,
                    order_items (
                        quantity,
                        unit_price_snapshot,
                        line_total,
                        product_name_snapshot
                    )
                `)
                .eq('id', orderId)
                .single();

            if (error) throw error;

            setOrder({
                ...orderData,
                items: orderData.order_items || []
            });
        } catch (error) {
            console.error('Error fetching order:', error);
            navigate('/');
        } finally {
            setLoading(false);
        }
    };

    const handlePayment = async () => {
        setFormError(null);

        // Validasyonlar
        if (!cardName || cardName.length < 5) {
            setFormError('Lütfen kart üzerindeki isim bilgisini eksiksiz giriniz.');
            return;
        }
        if (!cardNumber || cardNumber.length < 19) {
            setFormError('Lütfen geçerli bir kart numarası giriniz.');
            return;
        }
        if (!cardExpiry || cardExpiry.length < 5) {
            setFormError('Lütfen son kullanma tarihini (AA/YY) formatında giriniz.');
            return;
        }
        if (!cardCvc || cardCvc.length < 3) {
            setFormError('Lütfen CVV kodunu giriniz.');
            return;
        }
        if (!agreementChecked) {
            setFormError('Lütfen Mesafeli Satış Sözleşmesi ve Ön Bilgilendirme Formunu onaylayınız.');
            return;
        }

        setProcessing(true);

        try {
            // Garanti 3D Secure başlat
            const response = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/payment-initiate`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
                    },
                    body: JSON.stringify({
                        orderId: orderId,
                        cardNumber: cardNumber,
                        cardExpiry: cardExpiry,
                        cardCvc: cardCvc,
                        cardHolderName: cardName
                    })
                }
            );

            const data = await response.json();

            if (!response.ok || data.error) {
                throw new Error(data.error || 'Ödeme başlatılamadı');
            }

            // 3D Secure sayfasına yönlendir
            if (data.formHtml) {
                // Yeni pencerede 3D Secure formunu aç
                const newWindow = window.open('', '_self');
                if (newWindow) {
                    newWindow.document.write(data.formHtml);
                    newWindow.document.close();
                }
            } else if (data.redirectUrl) {
                window.location.href = data.redirectUrl;
            }

        } catch (error: any) {
            console.error('Payment error:', error);
            setFormError(error.message || 'Ödeme işlemi sırasında bir hata oluştu.');
            setProcessing(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="animate-spin h-12 w-12 border-4 border-[#6D4C41] rounded-full border-t-transparent"></div>
            </div>
        );
    }

    if (!order) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">Sipariş Bulunamadı</h2>
                    <button onClick={() => navigate('/')} className="text-[#6D4C41] hover:underline">
                        Ana Sayfaya Dön
                    </button>
                </div>
            </div>
        );
    }

    // Prices are VAT-INCLUSIVE (already included in grand_total)

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="container mx-auto px-4 max-w-7xl">
                {/* Progress Steps */}
                <div className="mb-8">
                    <div className="flex items-center justify-center max-w-3xl mx-auto relative">
                        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-gray-200 -z-10"></div>
                        <div className="absolute top-1/2 left-0 w-2/3 h-0.5 bg-[#6D4C41] -z-10"></div>

                        <div className="bg-white px-4 flex items-center gap-2">
                            <div className="w-10 h-10 rounded-full bg-[#6D4C41] text-white flex items-center justify-center font-bold">
                                <CheckCircle className="w-5 h-5" />
                            </div>
                            <span className="text-sm font-medium text-gray-900">Teslimat Bilgileri</span>
                        </div>

                        <div className="bg-white px-4 flex items-center gap-2">
                            <div className="w-10 h-10 rounded-full bg-[#6D4C41] text-white flex items-center justify-center font-bold">2</div>
                            <span className="text-sm font-medium text-[#6D4C41]">Ödeme İşlemleri</span>
                        </div>

                        <div className="bg-white px-4 flex items-center gap-2 opacity-50">
                            <div className="w-10 h-10 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center font-bold">3</div>
                            <span className="text-sm font-medium text-gray-600">Onay</span>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Payment Options */}
                    <div className="bg-white rounded-lg shadow-sm p-6">
                        <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                            <CreditCard className="w-6 h-6 text-[#6D4C41]" />
                            KREDİ KARTI İLE ÖDEME
                        </h2>

                        {/* Credit Card Form */}
                        <div className="space-y-6">
                            {/* Bank Logos / Information */}
                            <div className="flex items-center gap-4 p-4 bg-gray-50 border border-gray-200 rounded-lg mb-6">
                                <div className="flex -space-x-2">
                                    <div className="w-10 h-6 bg-blue-600 rounded text-white text-[8px] flex items-center justify-center font-bold italic border border-white">VISA</div>
                                    <div className="w-10 h-6 bg-red-600 rounded text-white text-[8px] flex items-center justify-center font-bold italic border border-white">MasterCard</div>
                                    <div className="w-10 h-6 bg-white rounded text-blue-800 text-[8px] flex items-center justify-center font-bold border border-gray-200">TROY</div>
                                </div>
                                <div className="text-sm text-gray-600">
                                    Garanti BBVA Sanal POS güvencesi ile tüm kredi kartları ile güvenli ödeme yapabilirsiniz.
                                </div>
                            </div>

                            <div className="grid gap-5">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Kart Üzerindeki İsim Soyisim</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6D4C41] focus:border-transparent transition-all placeholder-gray-300"
                                            placeholder="ADINIZ SOYADINIZ"
                                            value={cardName}
                                            onChange={(e) => setCardName(e.target.value.toUpperCase())}
                                        />
                                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Kart Numarası</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6D4C41] focus:border-transparent transition-all placeholder-gray-300 font-mono"
                                            placeholder="0000 0000 0000 0000"
                                            maxLength={19}
                                            value={cardNumber}
                                            onChange={(e) => {
                                                const val = e.target.value.replace(/\D/g, '').replace(/(.{4})/g, '$1 ').trim();
                                                setCardNumber(val.slice(0, 19));
                                            }}
                                        />
                                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                                            <CreditCard className="w-5 h-5" />
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-5">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Son Kullanma Tarihi</label>
                                        <input
                                            type="text"
                                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6D4C41] focus:border-transparent transition-all placeholder-gray-300 text-center"
                                            placeholder="AA / YY"
                                            maxLength={5}
                                            value={cardExpiry}
                                            onChange={(e) => {
                                                const val = e.target.value.replace(/\D/g, '');
                                                if (val.length >= 2) {
                                                    setCardExpiry(val.slice(0, 2) + '/' + val.slice(2, 4));
                                                } else {
                                                    setCardExpiry(val);
                                                }
                                            }}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center justify-between">
                                            CVV / CVC
                                            <span className="text-[10px] text-gray-400 cursor-help" title="Kartınızın arkasındaki 3 haneli kod">NEDİR?</span>
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6D4C41] focus:border-transparent transition-all placeholder-gray-300 text-center"
                                                placeholder="000"
                                                maxLength={3}
                                                value={cardCvc}
                                                onChange={(e) => setCardCvc(e.target.value.replace(/\D/g, '').slice(0, 3))}
                                            />
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                                                <Shield className="w-4 h-4" />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Taksit Seçenekleri (Opsiyonel - Mock) */}
                                <div className="mt-2">
                                    <label className="flex items-center gap-2 p-3 border border-[#6D4C41] bg-[#6D4C41]/5 rounded-lg cursor-pointer">
                                        <input type="radio" name="installment" defaultChecked className="text-[#6D4C41] focus:ring-[#6D4C41]" />
                                        <span className="text-sm font-bold text-gray-900">Tek Çekim</span>
                                        <span className="ml-auto text-sm font-bold text-[#6D4C41]">{formatCurrency(order.grand_total)}</span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Legal Agreements */}
                    <div className="bg-white rounded-lg shadow-sm p-6">
                        <h3 className="font-bold text-gray-900 mb-4">YASAL BİLDİRİMLER</h3>
                        <div className="space-y-3">
                            <details className="group border border-gray-200 rounded-lg">
                                <summary className="cursor-pointer text-sm text-gray-700 hover:text-[#6D4C41] font-medium p-4">
                                    ▸ ÖN BİLGİLENDİRME FORMU
                                </summary>
                                <div className="px-4 pb-4 text-xs text-gray-600 leading-relaxed max-h-60 overflow-y-auto">
                                    <p className="font-bold mb-2">1. SATICI BİLGİLERİ</p>
                                    <p>Ünvanı: İçel Solar Market</p>
                                    <p>Adres: Barış, Bahçeler Cd. Eroğlu plaza No:30/21, 33010 Akdeniz/Mersin</p>
                                    <p>Telefon: 0538 767 70 71</p>
                                    <p>E-posta: info@icelsolarmarket.com</p>

                                    <p className="font-bold mt-4 mb-2">2. ALICI BİLGİLERİ</p>
                                    <p>Adı Soyadı: {order.shipping_address?.full_name || order.guest_name}</p>
                                    <p>Adres: {order.shipping_address?.address_line} {order.shipping_address?.district}/{order.shipping_address?.city}</p>
                                    <p>Telefon: {order.shipping_address?.phone || order.guest_phone}</p>

                                    <p className="font-bold mt-4 mb-2">3. KONU</p>
                                    <p>İşbu formun konusu, aşağıda nitelikleri ve satış fiyatı belirtilen ürünlerin satışı ve teslimi ile ilgili olarak 6502 sayılı Tüketicinin Korunması Hakkında Kanun ve Mesafeli Sözleşmeler Yönetmeliği hükümleri gereğince tüketicinin bilgilendirilmesidir.</p>
                                </div>
                            </details>
                            <details className="group border border-gray-200 rounded-lg">
                                <summary className="cursor-pointer text-sm text-gray-700 hover:text-[#6D4C41] font-medium p-4">
                                    ▸ MESAFELİ SATIŞ SÖZLEŞMESİ
                                </summary>
                                <div className="px-4 pb-4 text-xs text-gray-600 leading-relaxed max-h-60 overflow-y-auto">
                                    <h4 className="font-bold mb-2">MESAFELİ SATIŞ SÖZLEŞMESİ</h4>
                                    <p className="font-bold mt-2">MADDE 1 – TARAFLAR</p>
                                    <p><strong>SATICI:</strong> İçel Solar Market</p>
                                    <p>Adres: Barış, Bahçeler Cd. Eroğlu plaza No:30/21, 33010 Akdeniz/Mersin</p>
                                    <p>Telefon: 0538 767 70 71</p>
                                    <p>E-posta: info@icelsolarmarket.com</p>

                                    <p className="mt-2"><strong>ALICI:</strong></p>
                                    <p>Adı Soyadı: {order.shipping_address?.full_name || order.guest_name}</p>
                                    <p>Adresi: {order.shipping_address?.address_line} {order.shipping_address?.district}/{order.shipping_address?.city}</p>
                                    <p>Telefon: {order.shipping_address?.phone || order.guest_phone}</p>

                                    <p className="font-bold mt-4">MADDE 2 – KONU</p>
                                    <p>İşbu sözleşmenin konusu, ALICI'nın SATICI'ya ait icelsolarmarket.com internet sitesinden elektronik ortamda siparişini yaptığı aşağıda nitelikleri ve satış fiyatı belirtilen ürünün satışı ve teslimi ile ilgili olarak 6502 sayılı Tüketicinin Korunması Hakkında Kanun ve Mesafeli Sözleşmeler Yönetmeliği hükümleri gereğince tarafların hak ve yükümlülüklerinin saptanmasıdır.</p>

                                    <p className="font-bold mt-4">MADDE 3 – SÖZLEŞME KONUSU ÜRÜN</p>
                                    <div className="mt-2 border border-gray-200 rounded p-2">
                                        {order.items.map((item, idx) => (
                                            <div key={idx} className="mb-1 border-b border-gray-100 last:border-0 pb-1">
                                                {item.product_name_snapshot} - {item.quantity} Adet - {formatCurrency(item.line_total)}
                                            </div>
                                        ))}
                                        <div className="font-bold mt-2 pt-1 border-t border-gray-200">
                                            TOPLAM: {formatCurrency(order.grand_total)}
                                        </div>
                                    </div>

                                    <p className="font-bold mt-4">MADDE 4 – GENEL HÜKÜMLER</p>
                                    <p>4.1. ALICI, internet sitesinde sözleşme konusu ürünün temel nitelikleri, satış fiyatı ve ödeme şekli ile teslimata ilişkin ön bilgileri okuyup bilgi sahibi olduğunu ve elektronik ortamda gerekli teyidi verdiğini beyan eder.</p>
                                    <p>4.2. Sözleşme konusu ürün, yasal 30 günlük süreyi aşmamak koşulu ile her bir ürün için ALICI'nın yerleşim yerinin uzaklığına bağlı olarak internet sitesinde ön bilgiler içinde açıklanan süre içinde ALICI veya gösterdiği adresteki kişi/kuruluşa teslim edilir.</p>
                                    <p>4.3. Kargo teslimatı sırasında ürünün zarar gördüğü tespit edilirse ALICI kargo yetkilisine tutanak tutturmalı ve ürünü teslim almamalıdır.</p>

                                    <p className="font-bold mt-4">MADDE 5 – YETKİLİ MAHKEME</p>
                                    <p>İşbu sözleşmenin uygulanmasında, Sanayi ve Ticaret Bakanlığınca ilan edilen değere kadar Tüketici Hakem Heyetleri ile ALICI'nın veya SATICI'nın yerleşim yerindeki Tüketici Mahkemeleri yetkilidir.</p>
                                    <p className="mt-4">Siparişin gerçekleşmesi durumunda ALICI işbu sözleşmenin tüm koşullarını kabul etmiş sayılır.</p>
                                </div>
                            </details>
                            <details className="group border border-gray-200 rounded-lg">
                                <summary className="cursor-pointer text-sm text-gray-700 hover:text-[#6D4C41] font-medium p-4">
                                    ▸ KİŞİSEL VERİLERİN KORUNMASI (KVKK)
                                </summary>
                                <div className="px-4 pb-4 text-xs text-gray-600 leading-relaxed max-h-60 overflow-y-auto">
                                    <p className="font-bold mb-2">İÇEL SOLAR MARKET KİŞİSEL VERİLERİN KORUNMASI VE İŞLENMESİ AYDINLATMA METNİ</p>
                                    <p><strong>Veri Sorumlusu:</strong> İçel Solar Market</p>
                                    <p>Adres: Barış, Bahçeler Cd. Eroğlu plaza No:30/21, 33010 Akdeniz/Mersin</p>

                                    <p className="mt-2">6698 sayılı Kişisel Verilerin Korunması Kanunu (“KVKK”) uyarınca, kişisel verileriniz; veri sorumlusu olarak Şirketimiz tarafından aşağıda açıklanan kapsamda işlenebilecektir.</p>

                                    <p className="font-bold mt-2">1. Kişisel Verilerin İşlenme Amacı</p>
                                    <p>Toplanan kişisel verileriniz (Ad, soyad, adres, telefon, e-posta, sipariş bilgileri, IP adresi); siparişlerin alınması, teslimat, ödeme güvenliği ve yasal yükümlülükler gibi amaçlarla işlenmektedir.</p>

                                    <p className="font-bold mt-2">2. İşlenen Kişisel Verilerin Aktarılması</p>
                                    <p>Kişisel verileriniz; kargo şirketleri, ödeme kuruluşları (Iyzico vb.) ve yasal zorunluluk halinde yetkili kamu kurumlarıyla paylaşılabilir.</p>

                                    <p className="font-bold mt-2">3. Veri Sahibinin Hakları</p>
                                    <p>KVKK Madde 11 uyarınca; verilerinizin işlenip işlenmediğini öğrenme, düzeltme ve silme talep etme hakkınız vardır. Taleplerinizi info@icelsolarmarket.com adresine iletebilirsiniz.</p>
                                </div>
                            </details>
                        </div>

                        <div className="mt-6 flex items-start gap-3">
                            <input
                                type="checkbox"
                                id="agreement"
                                checked={agreementChecked}
                                onChange={(e) => setAgreementChecked(e.target.checked)}
                                className="mt-1 w-4 h-4 text-[#6D4C41] border-gray-300 rounded focus:ring-[#6D4C41]"
                            />
                            <label htmlFor="agreement" className="text-xs text-gray-600">
                                "SİPARİŞİ TAMAMLA" butonuna basmanız halinde, seçmiş olduğunuz ödeme yöntemine uygun olarak,
                                toplam <strong>{formatCurrency(order.grand_total)}</strong> tahsil edilecektir.
                            </label>
                        </div>
                    </div>
                </div>

                {/* Right: Order Summary */}
                <div className="lg:col-span-1">
                    <div className="bg-white rounded-lg shadow-sm p-6 sticky top-4">
                        <h3 className="font-bold text-gray-900 mb-6 text-lg">SEPET ÖZETİ</h3>

                        {/* Order Items */}
                        <div className="space-y-3 mb-6 max-h-60 overflow-y-auto">
                            {order.items.map((item: any, index: number) => (
                                <div key={index} className="flex justify-between text-sm">
                                    <div className="flex-1">
                                        <div className="font-medium text-gray-900">{item.product_name_snapshot}</div>
                                        <div className="text-gray-500 text-xs">x{item.quantity}</div>
                                    </div>
                                    <div className="font-medium text-gray-900">{formatCurrency(item.line_total)}</div>
                                </div>
                            ))}
                        </div>

                        {/* Totals */}
                        <div className="border-t border-gray-200 pt-4 space-y-2 mb-6">
                            <div className="flex justify-between text-sm text-gray-600">
                                <span>Ara Toplam</span>
                                <span className="font-medium">{formatCurrency(order.grand_total)}</span>
                            </div>

                            <div className="flex justify-between text-sm text-gray-600">
                                <span>Kargo</span>
                                <span className="font-medium text-gray-900">Alıcı Ödemeli</span>
                            </div>
                        </div>

                        <div className="flex justify-between text-lg font-bold text-gray-900 mb-6 pb-6 border-b">
                            <span>Toplam</span>
                            <span className="text-[#6D4C41]">{formatCurrency(order.grand_total)}</span>
                        </div>

                        {formError && (
                            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex items-start gap-2">
                                <span className="text-lg">⚠️</span>
                                <span>{formError}</span>
                            </div>
                        )}

                        {/* Payment Button */}
                        <button
                            onClick={handlePayment}
                            disabled={processing}
                            className={`w-full py-4 rounded-lg font-bold text-white transition-all ${!processing
                                ? 'bg-[#6D4C41] hover:bg-[#5D4037] shadow-lg hover:shadow-xl'
                                : 'bg-gray-400 cursor-not-allowed'
                                }`}
                        >
                            {processing ? 'İşleniyor...' : 'SİPARİŞİ TAMAMLA'}
                        </button>

                        <div className="mt-4 flex items-center justify-center gap-2 text-xs text-gray-500">
                            <Shield className="w-4 h-4" />
                            <span>256-bit SSL Güvenli Ödeme</span>
                        </div>

                        {/* Shipping Address */}
                        {order.shipping_address && (
                            <div className="mt-6 pt-6 border-t border-gray-200">
                                <h4 className="font-bold text-sm text-gray-900 mb-3">TESLİMAT BİLGİLERİ</h4>
                                <div className="text-xs text-gray-600 space-y-1">
                                    <div className="font-medium">{order.shipping_address.full_name || order.guest_name}</div>
                                    <div>{order.shipping_address.address_line}</div>
                                    <div>{order.shipping_address.district} / {order.shipping_address.city}</div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PaymentPage;
