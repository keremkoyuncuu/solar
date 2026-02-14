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
    const [selectedInstallment, setSelectedInstallment] = useState(1); // 1 = tek çekim

    // UI State
    const [formError, setFormError] = useState<string | null>(null);

    // Taksit oranları (müşteriye yansıtılacak net oranlar)
    const INSTALLMENT_RATES: Record<number, number> = {
        1: 0,       // Tek çekim - komisyonsuz
        2: 2.99,
        3: 5.01,
        4: 7.10,
        5: 9.29,
        6: 11.57,
        7: 13.95,
        8: 16.43,
        9: 19.02,
        10: 21.73,
        11: 24.56,
        12: 27.53
    };

    // Toplam tutarı hesapla (komisyon dahil)
    const calculateTotal = () => {
        if (!order) return 0;
        const rate = INSTALLMENT_RATES[selectedInstallment] || 0;
        return order.grand_total * (1 + rate / 100);
    };

    // Aylık taksit tutarını hesapla
    const getMonthlyPayment = (installment: number) => {
        if (!order) return 0;
        const rate = INSTALLMENT_RATES[installment] || 0;
        const total = order.grand_total * (1 + rate / 100);
        return total / installment;
    };

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

    // 3D Secure form data state
    const [formData, setFormData] = useState<any>(null);
    const [redirectUrl, setRedirectUrl] = useState<string>('');

    // Form data geldiğinde formu oluşturup submit et
    useEffect(() => {
        if (formData && redirectUrl) {
            // Dinamik olarak form oluştur ve submit et
            const form = document.createElement('form');
            form.method = 'POST';
            form.action = redirectUrl;
            form.style.display = 'none';

            // Form alanlarını ekle
            Object.entries(formData).forEach(([key, value]) => {
                const input = document.createElement('input');
                input.type = 'hidden';
                input.name = key;
                input.value = String(value);
                form.appendChild(input);
            });

            // Formu body'ye ekle ve submit et
            document.body.appendChild(form);
            form.submit();
        }
    }, [formData, redirectUrl]);

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
            // DEBUG: Gönderilen değerleri logla
            const paymentData = {
                orderId: orderId,
                cardNumber: cardNumber,
                cardExpiry: cardExpiry,
                cardCvc: cardCvc,
                cardHolderName: cardName,
                installmentCount: selectedInstallment,
                totalAmount: calculateTotal()
            };
            console.log("=== PAYMENT DEBUG (Frontend) ===");
            console.log("selectedInstallment:", selectedInstallment);
            console.log("order.grand_total:", order?.grand_total);
            console.log("calculateTotal():", calculateTotal());
            console.log("Full payload:", paymentData);
            console.log("=== END DEBUG ===");

            // Garanti 3D Secure başlat
            const response = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/payment-initiate`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
                    },
                    body: JSON.stringify(paymentData)
                }
            );

            const data = await response.json();

            if (!response.ok || data.error) {
                throw new Error(data.error || 'Ödeme başlatılamadı');
            }

            // 3D Secure formu - useEffect auto-submit yapacak
            if (data.formData && data.redirectUrl) {
                setFormData(data.formData);
                setRedirectUrl(data.redirectUrl);
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

    // Eğer 3D Secure form submit ediliyorsa, loading göster
    if (formData && redirectUrl) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin h-12 w-12 border-4 border-[#6D4C41] rounded-full border-t-transparent mx-auto mb-4"></div>
                    <p className="text-gray-600">3D Secure sayfasına yönlendiriliyorsunuz...</p>
                </div>
            </div>
        );
    }

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
                            {/* Bank Logos / Information */}
                            <div className="bg-gray-50 border border-gray-200 rounded-lg mb-6 p-4 flex flex-col items-center gap-3">
                                <img
                                    src="/src/assets/images/iyzico-payment-logos.png"
                                    alt="Güvenli Ödeme"
                                    className="h-8 object-contain"
                                />
                                <div className="text-sm text-gray-600 text-center">
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

                                {/* Taksit Seçenekleri */}
                                <div className="mt-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-3">Taksit Seçenekleri</label>
                                    <div className="space-y-2 max-h-64 overflow-y-auto">
                                        {/* Tek Çekim */}
                                        <label
                                            className={`flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-all ${selectedInstallment === 1
                                                ? 'border-[#6D4C41] bg-[#6D4C41]/5 ring-2 ring-[#6D4C41]/20'
                                                : 'border-gray-200 hover:border-gray-300'
                                                }`}
                                        >
                                            <input
                                                type="radio"
                                                name="installment"
                                                checked={selectedInstallment === 1}
                                                onChange={() => setSelectedInstallment(1)}
                                                className="text-[#6D4C41] focus:ring-[#6D4C41]"
                                            />
                                            <div className="flex-1">
                                                <span className="text-sm font-bold text-gray-900">Tek Çekim</span>
                                                <span className="text-xs text-green-600 ml-2">(Komisyonsuz)</span>
                                            </div>
                                            <span className="text-sm font-bold text-[#6D4C41]">{formatCurrency(order.grand_total)}</span>
                                        </label>

                                        {/* Taksitli Seçenekler */}
                                        {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((inst) => (
                                            <label
                                                key={inst}
                                                className={`flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-all ${selectedInstallment === inst
                                                    ? 'border-[#6D4C41] bg-[#6D4C41]/5 ring-2 ring-[#6D4C41]/20'
                                                    : 'border-gray-200 hover:border-gray-300'
                                                    }`}
                                            >
                                                <input
                                                    type="radio"
                                                    name="installment"
                                                    checked={selectedInstallment === inst}
                                                    onChange={() => setSelectedInstallment(inst)}
                                                    className="text-[#6D4C41] focus:ring-[#6D4C41]"
                                                />
                                                <div className="flex-1">
                                                    <span className="text-sm font-bold text-gray-900">{inst} Taksit</span>
                                                    <span className="text-xs text-gray-500 ml-2">
                                                        (Aylık {formatCurrency(getMonthlyPayment(inst))})
                                                    </span>
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-sm font-bold text-[#6D4C41]">
                                                        {formatCurrency(order.grand_total * (1 + INSTALLMENT_RATES[inst] / 100))}
                                                    </span>
                                                    <span className="text-xs text-orange-600 block">
                                                        +%{INSTALLMENT_RATES[inst].toFixed(2)}
                                                    </span>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
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

                                    <p className="font-bold mt-2">1. TARAFLAR</p>
                                    <p>İşbu Sözleşme aşağıdaki taraflar arasında aşağıda belirtilen hüküm ve şartlar çerçevesinde imzalanmıştır.</p>

                                    <p className="mt-2"><strong>ALICI:</strong></p>
                                    <p>AD-SOYAD: {order.shipping_address?.full_name || order.guest_name}</p>
                                    <p>ADRES: {order.shipping_address?.address_line} {order.shipping_address?.district}/{order.shipping_address?.city}</p>
                                    <p>TELEFON: {order.shipping_address?.phone || order.guest_phone}</p>
                                    <p>EPOSTA: {order.guest_email || 'Sipariş esnasında belirtildi'}</p>

                                    <p className="mt-2"><strong>SATICI:</strong></p>
                                    <p>ÜNVANI: İçel Solar Market</p>
                                    <p>ADRES: Barış, Bahçeler Cd. Eroğlu plaza No:30/21, 33010 Akdeniz/Mersin</p>
                                    <p>TELEFON: 0538 767 70 71 - 0324 336 63 36</p>
                                    <p>EPOSTA: info@icelsolarmarket.com</p>

                                    <p className="mt-2">İş bu sözleşmeyi kabul etmekle ALICI, sözleşme konusu siparişi onayladığı takdirde sipariş konusu bedeli ve varsa kargo ücreti, vergi gibi belirtilen ek ücretleri ödeme yükümlülüğü altına gireceğini ve bu konuda bilgilendirildiğini peşinen kabul eder.</p>

                                    <p className="font-bold mt-4">2. TANIMLAR</p>
                                    <p className="font-bold mt-4">3. KONU</p>
                                    <p>İşbu Sözleşme, ALICI’nın, SATICI’ya ait internet sitesi üzerinden elektronik ortamda siparişini verdiği aşağıda nitelikleri ve satış fiyatı belirtilen ürünün satışı ve teslimi ile ilgili olarak 6502 sayılı Tüketicinin Korunması Hakkında Kanun ve Mesafeli Sözleşmelere Dair Yönetmelik hükümleri gereğince tarafların hak ve yükümlülüklerini düzenler.</p>
                                    <p>Listelenen ve sitede ilan edilen fiyatlar satış fiyatıdır. İlan edilen fiyatlar ve vaatler güncelleme yapılana ve değiştirilene kadar geçerlidir. Süreli olarak ilan edilen fiyatlar ise belirtilen süre sonuna kadar geçerlidir.</p>

                                    <p className="font-bold mt-4">4. SATICI BİLGİLERİ</p>
                                    <p>Ünvanı: İçel Solar Market</p>
                                    <p>Adres: Barış, Bahçeler Cd. Eroğlu plaza No:30/21, 33010 Akdeniz/Mersin</p>
                                    <p>Telefon: 0538 767 70 71 - 0324 336 63 36</p>
                                    <p>Eposta: info@icelsolarmarket.com</p>

                                    <p className="font-bold mt-4">5. ALICI BİLGİLERİ</p>
                                    <p>Teslim edilecek kişi: {order.shipping_address?.full_name || order.guest_name}</p>
                                    <p>Teslimat Adresi: {order.shipping_address?.address_line} {order.shipping_address?.district}/{order.shipping_address?.city}</p>
                                    <p>Telefon: {order.shipping_address?.phone || order.guest_phone}</p>
                                    <p>Eposta: {order.guest_email || 'Belirtilmedi'}</p>

                                    <p className="font-bold mt-4">6. SİPARİŞ VEREN KİŞİ BİLGİLERİ</p>
                                    <p>Ad/Soyad/Unvan: {order.shipping_address?.full_name || order.guest_name}</p>
                                    <p>Adres: {order.shipping_address?.address_line} {order.shipping_address?.district}/{order.shipping_address?.city}</p>
                                    <p>Telefon: {order.shipping_address?.phone || order.guest_phone}</p>
                                    <p>Eposta: {order.guest_email || 'Belirtilmedi'}</p>

                                    <p className="font-bold mt-4">7. SÖZLEŞME KONUSU ÜRÜN/ÜRÜNLER BİLGİLERİ</p>
                                    <p>7.1. Malın/Ürün/Ürünlerin/Hizmetin temel özelliklerini (türü, miktarı, marka/modeli, rengi, adedi) SATICI’ya ait internet sitesinde yayınlanmaktadır.</p>
                                    <p>7.2. Fiyatlar: Listelenen ve sitede ilan edilen fiyatlar satış fiyatıdır.</p>
                                    <p>7.3. Vergiler ve Ödemeler: Sözleşme konusu mal ya da hizmetin tüm vergiler dâhil satış fiyatı aşağıda gösterilmiştir.</p>

                                    <div className="mt-2 border border-gray-200 rounded p-2 bg-gray-50">
                                        <table className="w-full text-left text-[10px]">
                                            <thead>
                                                <tr className="border-b border-gray-200">
                                                    <th className="pb-1">Ürün Açıklaması</th>
                                                    <th className="pb-1">Adet</th>
                                                    <th className="pb-1">Birim Fiyat</th>
                                                    <th className="pb-1 text-right">Ara Toplam</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {order.items.map((item, idx) => (
                                                    <tr key={idx} className="border-b border-gray-100 last:border-0">
                                                        <td className="py-1 pr-1">{item.product_name_snapshot}</td>
                                                        <td className="py-1">{item.quantity}</td>
                                                        <td className="py-1">{formatCurrency(item.unit_price_snapshot)}</td>
                                                        <td className="py-1 text-right">{formatCurrency(item.line_total)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        <div className="font-bold mt-2 pt-1 border-t border-gray-200 text-right">
                                            TOPLAM: {formatCurrency(order.grand_total)}
                                        </div>
                                    </div>

                                    <p className="font-bold mt-4">8. FATURA BİLGİLERİ</p>
                                    <p>Ad/Soyad/Unvan: {order.shipping_address?.full_name || order.guest_name}</p>
                                    <p>Adres: {order.shipping_address?.address_line} {order.shipping_address?.district}/{order.shipping_address?.city}</p>
                                    <p>Telefon: {order.shipping_address?.phone || order.guest_phone}</p>
                                    <p>Fatura teslim: Fatura sipariş teslimatı sırasında fatura adresine sipariş ile birlikte teslim edilecektir.</p>

                                    <p className="font-bold mt-4">9. GENEL HÜKÜMLER</p>
                                    <p>9.1. Bilgilendirme ve Kabul: ALICI, SATICI’ya ait internet sitesinde sözleşme konusu ürünün temel nitelikleri, satış fiyatı ve ödeme şekli ile teslimata ilişkin ön bilgileri okuyup, bilgi sahibi olduğunu beyan eder.</p>
                                    <p>9.2. Teslim Süresi: Sözleşme konusu her bir ürün, 30 günlük yasal süreyi aşmamak kaydı ile ALICI’ya teslim edilir.</p>

                                    <p className="font-bold mt-4">10. CAYMA HAKKI</p>
                                    <p>ALICI, ürünün kendisine teslim tarihinden itibaren 14 gün içerisinde, SATICI’ya bildirmek şartıyla hiçbir gerekçe göstermeksizin malı reddederek sözleşmeden cayma hakkını kullanabilir.</p>

                                    <p className="font-bold mt-4">11. CAYMA HAKKI KULLANILAMAYACAK ÜRÜNLER</p>
                                    <p>ALICI’nın isteği veya açıkça kişisel ihtiyaçları doğrultusunda hazırlanan ürünler cayma hakkı kapsamı dışında kalmaktadır.</p>

                                    <p className="font-bold mt-4">12. TEMERRÜT HALİ</p>
                                    <p>ALICI, ödeme işlemlerini kredi kartı ile yaptığı durumda temerrüde düştüğü takdirde, kart sahibi banka ile arasındaki kredi kartı sözleşmesi çerçevesinde faiz ödeyeceğini kabul eder.</p>

                                    <p className="font-bold mt-4">13. YETKİLİ MAHKEME</p>
                                    <p>İşbu sözleşmeden doğan uyuşmazlıklarda tüketici hakem heyetleri veya tüketici mahkemeleri yetkilidir.</p>

                                    <p className="font-bold mt-4">14. YÜRÜRLÜK</p>
                                    <p>ALICI, Site üzerinden verdiği siparişe ait ödemeyi gerçekleştirdiğinde işbu sözleşmenin tüm şartlarını kabul etmiş sayılır.</p>

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
