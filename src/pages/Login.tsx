import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { mergeGuestCartToUser } from '../lib/cart';
import { Mail } from 'lucide-react';

const Login: React.FC = () => {
    const navigate = useNavigate();

    // View State
    const [isRegisterView, setIsRegisterView] = useState(false);
    const [registrationSuccess, setRegistrationSuccess] = useState(false);

    // Form Data
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [isTermsAccepted, setIsTermsAccepted] = useState(false);
    const [isMarketingAccepted, setIsMarketingAccepted] = useState(false);

    // UI State
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) throw error;
            if (data.user) {
                // Merge guest cart to user cart (if exists)
                await mergeGuestCartToUser(data.user.id);
                navigate('/admin');
            }
        } catch (err: any) {
            let errorMessage = err.message;
            if (errorMessage === 'Invalid login credentials') {
                errorMessage = 'Hatalı e-posta veya şifre.';
            } else if (errorMessage === 'Email not confirmed') {
                errorMessage = 'E-posta adresiniz henüz doğrulanmamış. Lütfen e-posta kutunuzu (ve spam klasörünü) kontrol edin.';
            }
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isTermsAccepted) {
            setError("Lütfen üyelik sözleşmesini onaylayın.");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const { error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: fullName,
                        is_marketing_accepted: isMarketingAccepted
                    }
                }
            });

            if (error) throw error;

            setRegistrationSuccess(true);

        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        try {
            const redirectUrl = `${window.location.origin}`;

            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: redirectUrl,
                },
            });
            if (error) throw error;
        } catch (err: any) {
            setError(err.message);
        }
    };

    // --- Başarı Ekranı (Register Success) ---
    if (registrationSuccess) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 font-sans text-gray-900 p-4">
                <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-10 text-center">
                    <div className="mb-6 flex justify-center">
                        <div className="p-4 bg-green-50 rounded-full">
                            <Mail className="w-12 h-12 text-green-600" />
                        </div>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">Kaydınız Başarıyla Alındı!</h2>
                    <p className="text-gray-600 mb-8 leading-relaxed">
                        Lütfen <span className="font-bold text-gray-900">{email}</span> adresine gönderdiğimiz doğrulama linkine tıklayarak hesabınızı aktif edin.
                    </p>
                    <button
                        onClick={() => {
                            setRegistrationSuccess(false);
                            setIsRegisterView(false);
                            setEmail('');
                            setPassword('');
                            setFullName('');
                            setError(null);
                        }}
                        className="w-full py-3.5 px-4 bg-[#6D4C41] hover:bg-[#5D4037] text-white font-bold rounded-lg shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-[#6D4C41]"
                    >
                        Giriş Ekranına Dön
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 font-sans text-gray-900 p-4">

            {/* CARD */}
            <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8 transition-all duration-300">
                <div className="text-center mb-8">
                    <h2 className="text-2xl font-bold text-gray-800">
                        {isRegisterView ? 'Aramıza Katıl' : 'Giriş Yap'}
                    </h2>
                </div>

                {error && (
                    <div className="mb-6 p-3 bg-red-50 text-red-600 text-sm rounded border border-red-100 text-center animate-pulse">
                        {error}
                    </div>
                )}

                <form onSubmit={isRegisterView ? handleRegister : handleLogin} className="space-y-4">

                    {/* AD SOYAD (Register Only) */}
                    {isRegisterView && (
                        <div className="space-y-1">
                            <label className="block text-sm font-medium text-gray-700">Ad Soyad</label>
                            <input
                                type="text"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                required={isRegisterView}
                                className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:border-[#6D4C41] focus:ring-1 focus:ring-[#6D4C41] outline-none transition-all placeholder-gray-400 text-sm"
                                placeholder="Adınız ve Soyadınız"
                            />
                        </div>
                    )}

                    {/* EMAIL */}
                    <div className="space-y-1">
                        <label className="block text-sm font-medium text-gray-700">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:border-[#6D4C41] focus:ring-1 focus:ring-[#6D4C41] outline-none transition-all placeholder-gray-400 text-sm"
                            placeholder="ornek@email.com"
                        />
                    </div>

                    {/* PASSWORD */}
                    <div className="space-y-1">
                        <label className="block text-sm font-medium text-gray-700">Şifre</label>
                        <div className="relative">
                            <input
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:border-[#6D4C41] focus:ring-1 focus:ring-[#6D4C41] outline-none transition-all placeholder-gray-400 text-sm pr-12"
                                placeholder="••••••••"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
                            >
                                {showPassword ? (
                                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                                ) : (
                                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                )}
                            </button>
                        </div>
                        {/* Forgot Password Link */}
                        {!isRegisterView && (
                            <div className="flex justify-end pt-1">
                                <Link to="/forgot-password" className="text-xs font-medium text-[#6D4C41] hover:underline">
                                    Şifremi Unuttum?
                                </Link>
                            </div>
                        )}
                    </div>

                    {/* CHECKBOXES (Register Only) */}
                    {isRegisterView && (
                        <div className="space-y-3 pt-2">
                            <label className="flex items-start gap-3 cursor-pointer group">
                                <div className="relative flex items-center">
                                    <input
                                        type="checkbox"
                                        checked={isTermsAccepted}
                                        onChange={(e) => setIsTermsAccepted(e.target.checked)}
                                        className="peer h-5 w-5 cursor-pointer appearance-none rounded border border-gray-300 bg-white transition-all checked:border-[#6D4C41] checked:bg-[#6D4C41]"
                                    />
                                    <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 transition-opacity peer-checked:opacity-100">
                                        <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                    </div>
                                </div>
                                <span className="text-sm text-gray-600 group-hover:text-gray-800 transition-colors">
                                    <span className="font-semibold text-[#6D4C41] underline">Üyelik Sözleşmesi</span>'ni okudum ve onaylıyorum.
                                </span>
                            </label>

                            <label className="flex items-start gap-3 cursor-pointer group">
                                <div className="relative flex items-center">
                                    <input
                                        type="checkbox"
                                        checked={isMarketingAccepted}
                                        onChange={(e) => setIsMarketingAccepted(e.target.checked)}
                                        className="peer h-5 w-5 cursor-pointer appearance-none rounded border border-gray-300 bg-white transition-all checked:border-[#6D4C41] checked:bg-[#6D4C41]"
                                    />
                                    <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 transition-opacity peer-checked:opacity-100">
                                        <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                    </div>
                                </div>
                                <span className="text-sm text-gray-500 group-hover:text-gray-700 transition-colors">
                                    Kampanyalardan e-posta ile haberdar olmak istiyorum.
                                </span>
                            </label>
                        </div>
                    )}

                    {/* SUBMIT BUTTON */}
                    <button
                        type="submit"
                        disabled={loading || (isRegisterView && !isTermsAccepted)}
                        className={`w-full py-3.5 px-4 bg-[#6D4C41] hover:bg-[#5D4037] text-white font-bold rounded-lg shadow-md hover:shadow-lg transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#6D4C41] disabled:opacity-50 disabled:cursor-not-allowed
                        ${loading ? 'cursor-wait opacity-80' : ''}`}
                    >
                        {loading
                            ? 'İşlem Sürüyor...'
                            : isRegisterView ? 'Kayıt Ol' : 'Giriş Yap'
                        }
                    </button>

                    <div className="relative py-2">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-gray-200"></div>
                        </div>
                        <div className="relative flex justify-center text-xs">
                            <span className="px-2 bg-white text-gray-500">veya</span>
                        </div>
                    </div>

                    {/* SOCIAL BUTTON - GOOGLE ONLY */}
                    <button
                        onClick={handleGoogleLogin}
                        type="button"
                        className="w-full flex items-center justify-center py-3 px-4 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 transition-colors shadow-sm text-gray-600 hover:text-gray-800"
                    >
                        <svg className="h-5 w-5 mr-3" viewBox="0 0 24 24">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                            <path d="M5.84 14.11c-.22-.66-.35-1.36-.35-2.11s.13-1.45.35-2.11V7.05H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.95l3.66-2.84z" fill="#FBBC05" />
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.05l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                        </svg>
                        <span className="text-sm font-medium">Google ile {isRegisterView ? 'Kayıt Ol' : 'Giriş Yap'}</span>
                    </button>
                </form>

                {/* TOGGLE SECTION */}
                <div className="mt-8 pt-4 border-t border-gray-100 flex flex-col items-center gap-3">
                    <p className="text-sm text-gray-600">
                        {isRegisterView ? 'Zaten bir hesabınız var mı?' : 'Henüz bir hesabınız yok mu?'}
                    </p>
                    <button
                        type="button"
                        onClick={() => {
                            setIsRegisterView(!isRegisterView);
                            setError(null);
                        }}
                        className="w-full py-3 px-4 bg-[#F5DEB3] hover:bg-[#E6CFA5] text-gray-800 font-bold rounded-lg transition-colors text-sm shadow-sm"
                    >
                        {isRegisterView ? 'Giriş Yap' : 'Hemen Üye Ol'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Login;
