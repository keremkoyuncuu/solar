import React from 'react';
import { Link } from 'react-router-dom';
import { Mail, Phone, MapPin } from 'lucide-react';
import paymentLogos from '../assets/images/iyzico-payment-logos.png';

const Footer: React.FC = () => {
    return (
        <footer className="bg-[#1a1a1a] text-white">
            <div className="container mx-auto px-4 py-12">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                    {/* Logo & Description */}
                    <div>
                        <img src="/logo.png" alt="İçel Solar Market" className="h-20 w-auto mb-4 brightness-110" />
                        <p className="text-gray-400 text-sm leading-relaxed">
                            Güneş enerjisi sistemleri ve enerji çözümlerinde güvenilir adresiniz.
                        </p>
                    </div>

                    {/* Quick Links */}
                    <div>
                        <h4 className="text-lg font-bold mb-4">Hızlı Linkler</h4>
                        <ul className="space-y-2 text-sm">
                            <li><Link to="/products" className="text-gray-400 hover:text-[#f0c961] transition-colors">Ürünler</Link></li>
                            <li><Link to="/hakkimizda" className="text-gray-400 hover:text-[#f0c961] transition-colors">Hakkımızda</Link></li>
                            <li><Link to="/iletisim" className="text-gray-400 hover:text-[#f0c961] transition-colors">İletişim</Link></li>
                            <li><Link to="/bayi-basvuru" className="text-gray-400 hover:text-[#f0c961] transition-colors">Bayilik Başvurusu</Link></li>
                        </ul>
                    </div>

                    {/* Legal */}
                    <div>
                        <h4 className="text-lg font-bold mb-4">Kurumsal</h4>
                        <ul className="space-y-2 text-sm">
                            <li><Link to="/kurumsal/gizlilik-politikasi" className="text-gray-400 hover:text-[#f0c961] transition-colors">Gizlilik Politikası</Link></li>
                            <li><Link to="/kurumsal/kullanim-kosullari" className="text-gray-400 hover:text-[#f0c961] transition-colors">Kullanım Koşulları</Link></li>
                            <li><Link to="/kurumsal/iptal-iade" className="text-gray-400 hover:text-[#f0c961] transition-colors">İptal ve İade</Link></li>
                            <li><Link to="/kurumsal/mesafeli-satis-sozlesmesi" className="text-gray-400 hover:text-[#f0c961] transition-colors">Mesafeli Satış Sözleşmesi</Link></li>
                            <li><Link to="/kurumsal/kvkk-aydinlatma-metni" className="text-gray-400 hover:text-[#f0c961] transition-colors">KVKK Aydınlatma Metni</Link></li>
                        </ul>
                    </div>

                    {/* Contact */}
                    <div>
                        <h4 className="text-lg font-bold mb-4">İletişim</h4>
                        <ul className="space-y-3 text-sm text-gray-400">
                            <li className="flex items-start gap-2">
                                <Phone className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                <div className="flex flex-col">
                                    <span>0538 767 70 71</span>
                                    <span>0324 336 63 36</span>
                                </div>
                            </li>
                            <li className="flex items-start gap-2">
                                <Mail className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                <span>info@icelsolarmarket.com</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                <a
                                    href="https://maps.app.goo.gl/s3YtjXsFTfuLDjRg9?g_st=ic"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="hover:text-[#f0c961] transition-colors"
                                >
                                    Barış, Bahçeler Cd. Eroğlu Plaza No:30/21, 33010 Akdeniz/Mersin
                                </a>
                            </li>
                        </ul>


                    </div>
                </div>

                {/* Payment Logos */}
                <div className="flex justify-center mt-8 pb-6 border-b border-white/10">
                    <img
                        src={paymentLogos}
                        alt="Ödeme Yöntemleri"
                        className="h-8 md:h-10 object-contain opacity-80 hover:opacity-100 transition-opacity"
                    />
                </div>

                {/* Copyright */}
                <div className="pt-6 text-center text-sm text-gray-500">
                    © {new Date().getFullYear()} Icel Solar Market. Tüm hakları saklıdır.
                </div>
            </div>
        </footer>
    );
};

export default Footer;
