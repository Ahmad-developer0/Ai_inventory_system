-- Starter data: categories, products (opening stock ke saath), customers, suppliers.
-- Migrations ke baad aik dafa run karein. Apna asli data baad mein Products page ya Bulk Upload se daalein.

insert into public.categories (name) values
  ('Solar Inverters'), ('VFDs'), ('Batteries'), ('Cables'), ('Electrical Accessories');

insert into public.categories (name, parent_id) values
  ('Hybrid Inverters', (select id from public.categories where name = 'Solar Inverters')),
  ('Lithium Batteries', (select id from public.categories where name = 'Batteries'));

insert into public.products (sku, name, brand, model, category_id, specifications, purchase_price, selling_price, min_price, reorder_level)
select v.sku, v.name, v.brand, v.model, c.id, v.specs, v.cost, v.price, v.min_price, v.reorder
from (values
  ('INV-HYB-6K', 'Hybrid Inverter 6kW', 'Growatt', 'SPF 6000 ES Plus', 'Hybrid Inverters', 'Rated power: 6kW
Battery voltage: 48V
PV input: 500V DC max', 198000, 228000, 215000, 5),
  ('INV-HYB-10K', 'Hybrid Inverter 10kW', 'Inverex', 'Nitrox 10kW', 'Hybrid Inverters', 'Rated power: 10kW
Battery voltage: 48V', 345000, 392000, 370000, 4),
  ('INV-ONG-15K', 'On-Grid Inverter 15kW', 'Huawei', 'SUN2000-15KTL-M2', 'Solar Inverters', 'Rated power: 15kW
Output: 3-phase 400V', 410000, 465000, 440000, 2),
  ('VFD-7.5-3P', 'VFD 7.5kW (3-phase in)', 'INVT', 'GD20-7R5G-4', 'VFDs', 'Motor: 7.5kW / 10HP
Input: 3-phase 380V
Output: 3-phase 380V', 88000, 104000, 97000, 3),
  ('VFD-2.2-1P', 'VFD 2.2kW (1-phase in, 3-phase out)', 'Delta', 'VFD22EL21A', 'VFDs', 'Motor: 2.2kW / 3HP
Input: 1-phase 220V
Output: 3-phase 220V (motor delta connection)', 36000, 43500, 40000, 3),
  ('VFD-SOL-15', 'Solar Pump VFD 15kW', 'INVT', 'GD100-PV 15kW', 'VFDs', 'Motor: 15kW / 20HP
Input: PV DC or 3-phase AC 380V
MPPT built-in', 152000, 178000, 168000, 2),
  ('BAT-LI-5K', 'Lithium Battery 5.12kWh', 'Pylontech', 'US5000', 'Lithium Batteries', 'Voltage: 48V (51.2V nominal)
Capacity: 100Ah
Cycle life: 6000+', 255000, 289000, 275000, 4),
  ('BAT-TUB-200', 'Tubular Battery 200Ah', 'Phoenix', 'TX-2500', 'Batteries', '12V 200Ah lead-acid tubular', 58000, 66500, 63000, 8),
  ('CAB-DC-6', 'Solar DC Cable 6mm² (100m)', 'Fast Cables', 'PV1-F 6mm²', 'Cables', '6mm² tinned copper, 1500V DC, 100m roll', 31000, 36500, 34500, 10),
  ('CAB-AC-4C10', 'Copper Cable 4-core 10mm² (per m)', 'Pakistan Cables', '4C x 10mm²', 'Cables', '4-core 10mm² copper, PVC armoured, per meter', 1450, 1720, 1640, 200),
  ('ACC-MCB-32', 'DC MCB 32A 2-pole', 'Tomzn', 'TOB1Z-63', 'Electrical Accessories', '32A, 550V DC, 2-pole', 1150, 1500, 1350, 25),
  ('ACC-SPD-DC', 'DC Surge Protector', 'Tomzn', 'TOV1-40PV', 'Electrical Accessories', '1000V DC, 40kA', 2300, 2950, 2700, 15)
) as v(sku, name, brand, model, category, specs, cost, price, min_price, reorder)
join public.categories c on c.name = v.category;

-- Opening stock: stock hamesha movement se aata hai
insert into public.stock_movements (product_id, type, qty, reference, created_by)
select p.id, 'IN', v.qty, 'Opening stock', null
from (values
  ('INV-HYB-6K', 14), ('INV-HYB-10K', 3), ('INV-ONG-15K', 6), ('VFD-7.5-3P', 9), ('VFD-SOL-15', 4),
  ('BAT-LI-5K', 11), ('BAT-TUB-200', 22), ('CAB-DC-6', 40), ('CAB-AC-4C10', 650), ('ACC-MCB-32', 6), ('ACC-SPD-DC', 34)
) as v(sku, qty)
join public.products p on p.sku = v.sku;
-- VFD-2.2-1P jaan boojh kar 0 stock par hai (out-of-stock alert test karne ke liye)

insert into public.customers (name, phone, city, type) values
  ('Bilal Solar Solutions', '+92 300 1234567', 'Lahore', 'Installer'),
  ('Haji Rashid Farms', '+92 301 7654321', 'Okara', 'Retail'),
  ('Al-Noor Electric Store', '+92 321 5558899', 'Faisalabad', 'Dealer'),
  ('Sana Textile Mills', '+92 333 4441122', 'Kasur', 'Retail');

insert into public.suppliers (name, phone, city, notes) values
  ('Growatt Pakistan Distributor', '+92 42 3588 1100', 'Lahore', 'Hybrid inverters'),
  ('INVT Drives Karachi', '+92 21 3456 7788', 'Karachi', 'VFDs, solar pump drives'),
  ('Pylontech Authorized Dealer', '+92 51 2223 4455', 'Islamabad', 'Lithium batteries'),
  ('Hall Road Accessories', '+92 300 8889911', 'Lahore', 'MCBs, SPDs, connectors');
