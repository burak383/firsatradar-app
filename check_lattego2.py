import sqlite3
con = sqlite3.connect(r"C:\Users\Burak\Downloads\firsatradar\telegram_listener\telegram_listener\data\messages.db")
cur = con.cursor()
cur.execute("SELECT COUNT(*) FROM raw_messages")
print("toplam mesaj:", cur.fetchone()[0])

cur.execute("SELECT id, channel, message_date, product_guess, price_amount FROM raw_messages WHERE raw_text LIKE '%hilips%' ORDER BY id DESC LIMIT 10")
print("--- Philips gecen mesajlar ---")
for row in cur.fetchall():
    print(row)

cur.execute("SELECT id, channel, message_date, product_guess, price_amount FROM raw_messages ORDER BY id DESC LIMIT 5")
print("--- en son 5 mesaj (genel) ---")
for row in cur.fetchall():
    print(row)
