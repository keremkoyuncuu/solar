-- 1. variant_prices tablosunun şemasını düzeltme (Eğer yanlışsa)

-- HSenaryo 1: variant_id sütunu INTEGER ise UUID'ye çevir (Çünkü product_variants.id UUID)
do $$
begin
    -- variant_id sütununun tipini kontrol et
    if exists (
        select 1 
        from information_schema.columns 
        where table_name = 'variant_prices' 
        and column_name = 'variant_id' 
        and data_type = 'integer'
    ) then
        -- Eğer integer ise, bu yanlıştır. Muhtemelen tablo yanlış oluşturuldu.
        -- Tabloyu yeniden oluşturmak en temizidir (verilerle birlikte).
        -- Ancak burada ALTER komutu ile düzeltmeye çalışalım.
        
        -- Önce constraintleri kaldır
        alter table variant_prices drop constraint if exists variant_prices_variant_id_fkey;
        
        -- Sütun tipini değiştir (USING ile dönüştürme yapılamaz çünkü UUID string değil, o yüzden tabloyu silip yeniden oluşturmak daha güvenli olabilir ama veri kaybı riski var. 
        -- Ancak hata "invalid input syntax for type integer" dediğine göre, şu an veritabanına UUID  gönderiliyor ama sütun INTEGER bekliyor.)
        
        alter table variant_prices alter column variant_id type uuid using variant_id::text::uuid;
        
        -- Constrainti tekrar ekle
        alter table variant_prices add constraint variant_prices_variant_id_fkey foreign key (variant_id) references product_variants(id) on delete cascade;
    end if;
end $$;

-- Senaryo 2: price_list_id sütunu UUID ise INTEGER'a çevir (Çünkü price_lists.id INTEGER)
do $$
begin
    if exists (
        select 1 
        from information_schema.columns 
        where table_name = 'variant_prices' 
        and column_name = 'price_list_id' 
        and data_type = 'uuid'
    ) then
        alter table variant_prices drop constraint if exists variant_prices_price_list_id_fkey;
        alter table variant_prices alter column price_list_id type integer using price_list_id::integer;
        alter table variant_prices add constraint variant_prices_price_list_id_fkey foreign key (price_list_id) references price_lists(id) on delete cascade;
    end if;
end $$;

-- 3. Trigger Fonksiyonlarını Güncelle (Garanti olsun diye tekrar tanımlıyoruz)
create or replace function update_single_b2b_price()
returns trigger
language plpgsql
security definer
as $$
declare
    b2b_percentage numeric;
    b2b_list_id int;
    new_price numeric;
    settings_json jsonb;
begin
    if OLD.base_price = NEW.base_price then
        return new;
    end if;

    select value into settings_json from app_settings where key = 'b2b_discount_percentage';
    b2b_percentage := coalesce((settings_json->>'percentage')::numeric, 0);
    
    -- price_lists.id integer olduğu için casting gerekmez ama emin olmak için:
    select id into b2b_list_id from price_lists where type = 'b2b' limit 1;
    if b2b_list_id is null then
        select id into b2b_list_id from price_lists where name = 'B2B Fiyat Listesi' limit 1;
    end if; 
    
    -- Eğer liste hala yoksa oluştur
    if b2b_list_id is null then
         insert into price_lists (name, currency, type) values ('B2B Fiyat Listesi', 'TRY', 'b2b') returning id into b2b_list_id;
    end if;

    new_price := NEW.base_price * (1 - b2b_percentage / 100.0);

    -- NEW.id UUID tipindedir. variant_prices.variant_id de UUID olmalıdır.
    insert into variant_prices (variant_id, price_list_id, price, is_active)
    values (NEW.id, b2b_list_id, new_price, true)
    on conflict (variant_id, price_list_id) 
    do update set price = excluded.price, updated_at = now();

    return new;
end;
$$;

create or replace function update_all_b2b_prices()
returns trigger
language plpgsql
security definer
as $$
declare
    b2b_percentage numeric;
    b2b_list_id int;
    rec record;
    new_price numeric;
begin
    b2b_percentage := coalesce((NEW.value->>'percentage')::numeric, 0);
    
    select id into b2b_list_id from price_lists where type = 'b2b' limit 1;
    if b2b_list_id is null then
        select id into b2b_list_id from price_lists where name = 'B2B Fiyat Listesi' limit 1;
    end if;
    if b2b_list_id is null then
         insert into price_lists (name, currency, type) values ('B2B Fiyat Listesi', 'TRY', 'b2b') returning id into b2b_list_id;
    end if;

    for rec in select id, base_price from product_variants loop
        new_price := rec.base_price * (1 - b2b_percentage / 100.0);

        insert into variant_prices (variant_id, price_list_id, price, is_active)
        values (rec.id, b2b_list_id, new_price, true)
        on conflict (variant_id, price_list_id) 
        do update set price = excluded.price, updated_at = now();
    end loop;

    return new;
end;
$$;
