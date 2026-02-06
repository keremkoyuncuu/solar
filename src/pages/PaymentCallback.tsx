import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

// Bu sayfa 3D Secure callback'inden dönen istekleri işler
// Supabase Edge Function'a yönlendirir

const PaymentCallback: React.FC = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [status, setStatus] = useState<'processing' | 'error'>('processing');

    useEffect(() => {
        const processCallback = async () => {
            try {
                const txid = searchParams.get('txid');
                const error = searchParams.get('error');

                if (error) {
                    navigate(`/payment/fail?error=${error}`);
                    return;
                }

                if (!txid) {
                    navigate('/payment/fail?error=missing_transaction');
                    return;
                }

                // Bu sayfa normalde Edge Function callback tarafından handle edilir
                // Eğer buraya düşerse, muhtemelen bir hata var
                setStatus('error');

            } catch (err) {
                console.error('Callback processing error:', err);
                setStatus('error');
            }
        };

        processCallback();
    }, [searchParams, navigate]);

    if (status === 'error') {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="text-center">
                    <h2 className="text-xl font-bold text-gray-900 mb-4">
                        İşlem Doğrulanamadı
                    </h2>
                    <p className="text-gray-600 mb-6">
                        Ödeme durumu kontrol edilemedi. Lütfen siparişlerinizi kontrol edin.
                    </p>
                    <button
                        onClick={() => navigate('/account')}
                        className="px-6 py-3 bg-amber-500 text-white rounded-lg font-semibold hover:bg-amber-600 transition-colors"
                    >
                        Siparişlerimi Kontrol Et
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="text-center">
                <Loader2 className="w-16 h-16 text-amber-500 animate-spin mx-auto mb-6" />
                <h2 className="text-xl font-bold text-gray-900 mb-2">
                    Ödemeniz İşleniyor
                </h2>
                <p className="text-gray-600">
                    Lütfen bekleyin, sizi yönlendiriyoruz...
                </p>
            </div>
        </div>
    );
};

export default PaymentCallback;
