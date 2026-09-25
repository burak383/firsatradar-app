import sqlite3
con = sqlite3.connect(r"C:\Users\Burak\Downloads\firsatradar\telegram_listener\telegram_listener\data\messages.db")
cur = con.cursor()
cur.execute("""
  SELECT id, channel, message_date, raw_text, product_guess, price_amount, discount_percent, shop_links
  FROM raw_messages
  WHERE raw_text LIKE '%attego%' OR product_guess LIKE '%attego%'
  ORDER BY id DESC LIMIT 5
""")
for row in cur.fetchall():
    print("=" * 50)
    print("id:", row[0], "| channel:", row[1], "| date:", row[2])
    print("product_guess:", row[4])
    print("price_amount:", row[5], "| discount_percent:", row[6])
    print("shop_links:", row[7])
    print("--- raw_text ---")
    print(row[3])
