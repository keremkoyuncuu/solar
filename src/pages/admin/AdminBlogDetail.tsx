import imageCompression from 'browser-image-compression';
import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Upload, X } from 'lucide-react';
import type { Blog } from '../../types/blog';

const AdminBlogDetail: React.FC = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    const [formData, setFormData] = useState<Partial<Blog>>({
        title: '',
        slug: '',
        content: '',
        excerpt: '',
        image_url: '',
        category: '',
        author: 'İçel Solar',
        reading_time: '',
        is_active: true,
    });

    useEffect(() => {
        if (id && id !== 'new') {
            fetchBlog(id);
        }
    }, [id]);

    const fetchBlog = async (blogId: string) => {
        setLoading(true);
        const { data, error } = await supabase
            .from('blogs')
            .select('*')
            .eq('id', blogId)
            .single();

        if (error) {
            console.error('Error fetching blog:', error);
            alert('Blog yazısı yüklenirken hata oluştu.');
        } else if (data) {
            setFormData(data);
        }
        setLoading(false);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));

        if (name === 'title' && !id) {
            // Auto-generate slug from title for new posts
            const slug = value.toLowerCase()
                .replace(/ğ/g, 'g')
                .replace(/ü/g, 'u')
                .replace(/ş/g, 's')
                .replace(/ı/g, 'i')
                .replace(/ö/g, 'o')
                .replace(/ç/g, 'c')
                .replace(/[^a-z0-9\s-]/g, '')
                .replace(/\s+/g, '-');
            setFormData(prev => ({ ...prev, slug: slug }));
        }
    };

    const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, checked } = e.target;
        setFormData(prev => ({ ...prev, [name]: checked }));
    };


    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;

        let file = e.target.files[0];

        // Sıkıştırma Ayarları
        const options = {
            maxSizeMB: 0.5, // Maksimum 0.5MB
            maxWidthOrHeight: 1200, // Maksimum genişlik/yükseklik
            useWebWorker: true,
            fileType: 'image/webp' // WebP formatına çevir
        };

        setLoading(true);
        try {
            // 1. Resmi Sıkıştır
            console.log(`Orjinal dosya boyutu: ${(file.size / 1024 / 1024).toFixed(2)} MB`);
            const compressedFile = await imageCompression(file, options);
            console.log(`Sıkıştırılmış dosya boyutu: ${(compressedFile.size / 1024 / 1024).toFixed(2)} MB`);

            // 2. Dosya ismini hazırla (.webp olarak)
            const fileExt = 'webp';
            const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
            const filePath = `${fileName}`;

            // 3. Supabase'e Yükle
            const { error: uploadError } = await supabase.storage
                .from('blog-images')
                .upload(filePath, compressedFile);

            if (uploadError) throw uploadError;

            const { data } = supabase.storage.from('blog-images').getPublicUrl(filePath);

            setFormData(prev => ({ ...prev, image_url: data.publicUrl }));
        } catch (error: any) {
            console.error('Error uploading image:', error);
            alert('Resim yüklenirken hata oluştu: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!formData.title || !formData.slug || !formData.content) {
            alert('Başlık, Slug ve İçerik alanları zorunludur.');
            return;
        }

        setSaving(true);
        try {
            if (id && id !== 'new') {
                const { error } = await supabase
                    .from('blogs')
                    .update({
                        ...formData,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('blogs')
                    .insert([formData]);
                if (error) throw error;
            }

            alert('Blog yazısı başarıyla kaydedildi.');
            navigate('/admin/blogs');
        } catch (error: any) {
            console.error('Error saving blog:', error);
            alert('Kaydetme başarısız: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading && id !== 'new') {
        return <div className="p-8 text-center">Yükleniyor...</div>;
    }

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-8">
                <button
                    onClick={() => navigate('/admin/blogs')}
                    className="flex items-center text-gray-500 hover:text-gray-700 transition-colors"
                >
                    <ArrowLeft className="mr-2" size={20} />
                    Listeye Dön
                </button>
                <h1 className="text-2xl font-bold text-gray-900">
                    {id && id !== 'new' ? 'Blog Yazısını Düzenle' : 'Yeni Blog Yazısı'}
                </h1>
                <div className="w-24"></div> {/* Spacer for centering if needed, or just empty */}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 space-y-6">

                {/* Title & Slug */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Başlık <span className="text-red-500">*</span></label>
                        <input
                            type="text"
                            name="title"
                            value={formData.title}
                            onChange={handleChange}
                            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#f0c961] focus:border-transparent"
                            placeholder="Blog başlığı..."
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Slug (URL) <span className="text-red-500">*</span></label>
                        <input
                            type="text"
                            name="slug"
                            value={formData.slug}
                            onChange={handleChange}
                            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#f0c961] focus:border-transparent font-mono text-sm text-gray-500 bg-gray-50"
                        />
                    </div>
                </div>

                {/* Cover Image */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Kapak Görseli</label>
                    <div className="flex items-start gap-6">
                        {formData.image_url ? (
                            <div className="relative group">
                                <img
                                    src={formData.image_url}
                                    alt="Kapak"
                                    className="w-48 h-32 object-cover rounded-lg border border-gray-200"
                                />
                                <button
                                    onClick={() => setFormData(prev => ({ ...prev, image_url: '' }))}
                                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        ) : (
                            <div className="w-48 h-32 bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400">
                                <span className="text-xs">Görsel Yok</span>
                            </div>
                        )}
                        <div className="flex-1">
                            <label className="cursor-pointer bg-white border border-gray-300 text-gray-700 font-medium py-2 px-4 rounded-lg hover:bg-gray-50 inline-flex items-center gap-2 transition-colors shadow-sm">
                                <Upload size={18} />
                                Görsel Yükle
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handleImageUpload}
                                />
                            </label>
                            <p className="text-xs text-gray-500 mt-2">
                                Önerilen boyut: 1200x630px. Max: 5MB.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Metadata */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Kategori</label>
                        <input
                            type="text"
                            name="category"
                            value={formData.category || ''}
                            onChange={handleChange}
                            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#f0c961] focus:border-transparent"
                            placeholder="Örn: Temizlik İpuçları"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Yazar</label>
                        <input
                            type="text"
                            name="author"
                            value={formData.author || ''}
                            onChange={handleChange}
                            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#f0c961] focus:border-transparent"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Okuma Süresi</label>
                        <input
                            type="text"
                            name="reading_time"
                            value={formData.reading_time || ''}
                            onChange={handleChange}
                            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#f0c961] focus:border-transparent"
                            placeholder="Örn: 5 dk okuma"
                        />
                    </div>
                </div>

                {/* Excerpt */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Özet (Excerpt)</label>
                    <textarea
                        name="excerpt"
                        value={formData.excerpt || ''}
                        onChange={handleChange}
                        rows={3}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#f0c961] focus:border-transparent"
                        placeholder="Yazının kısa bir özeti..."
                    ></textarea>
                </div>

                {/* Content */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">İçerik (HTML) <span className="text-red-500">*</span></label>
                    <p className="text-xs text-gray-500 mb-2">HTML etiketlerini kullanabilirsiniz (`&lt;p&gt;`, `&lt;h2&gt;`, `&lt;strong&gt;` vb.) veya düz metin yazabilirsiniz.</p>
                    <textarea
                        name="content"
                        value={formData.content}
                        onChange={handleChange}
                        rows={15}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#f0c961] focus:border-transparent font-mono text-sm"
                        placeholder="<p>Blog yazınızı buraya yazın...</p>"
                    ></textarea>
                </div>

                {/* Status */}
                <div className="flex items-center gap-3 pt-2">
                    <input
                        type="checkbox"
                        id="is_active"
                        name="is_active"
                        checked={formData.is_active}
                        onChange={handleCheckboxChange}
                        className="w-5 h-5 text-[#f0c961] border-gray-300 rounded focus:ring-[#f0c961]"
                    />
                    <label htmlFor="is_active" className="text-sm font-medium text-gray-700 cursor-pointer select-none">
                        Yayında (Aktif)
                    </label>
                </div>

                {/* Action Buttons */}
                <div className="pt-6 border-t border-gray-100 flex justify-end gap-3">
                    <button
                        onClick={() => navigate('/admin/blogs')}
                        className="px-6 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 bg-white border border-gray-300 rounded-lg transition-colors"
                        disabled={saving}
                    >
                        İptal
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-8 py-2 text-sm font-bold text-black bg-[#f0c961] hover:bg-[#e0b850] rounded-lg shadow-sm disabled:opacity-50 flex items-center gap-2 transition-colors"
                    >
                        <Save size={18} />
                        {saving ? 'Kaydediliyor...' : 'Kaydet'}
                    </button>
                </div>

            </div>
        </div>
    );
};

export default AdminBlogDetail;
