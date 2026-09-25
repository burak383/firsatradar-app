import sqlite3
con = sqlite3.connect(r"C:\Users\Burak\Downloads\firsatradar\telegram_listener\telegram_listener\data\messages.db")
cur = con.cursor()
cur.execute("SELECT raw_text, discount_percent, shop_links FROM raw_messages WHERE id = 41")
row = cur.fetchone()
print("raw_text:")
print(row[0])
print("discount_percent:", row[1])
print("shop_links:", row[2])
