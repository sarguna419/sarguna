import pandas as pd
import matplotlib.pyplot as plt
import numpy as np

# Create sample email data
data = {
    'sender': ['boss@company.com', 'colleague@company.com', 'client@external.com', 'newsletter@service.com', 'boss@company.com'],
    'recipient': ['you@company.com', 'you@company.com', 'you@company.com', 'you@company.com', 'team@company.com'],
    'subject': ['Urgent: Meeting Today', 'Project Update', 'Contract Discussion', 'Weekly Newsletter', 'Performance Review'],
    'date': pd.date_range('2023-01-01', periods=5, freq='D'),
    'size_kb': [150, 230, 540, 1200, 180],
    'is_read': [True, True, False, False, True],
    'category': ['work', 'work', 'work', 'promotion', 'work']
}

# Create DataFrame
df = pd.DataFrame(data)

# Basic EDA
print("Dataset Info:")
print(df.info())
print("\nFirst 5 rows:")
print(df.head())

# Insights
print("\nEmail Analysis:")
print(f"Total emails: {len(df)}")
print(f"Unique senders: {df['sender'].nunique()}")
print(f"Read emails: {df['is_read'].sum()}")
print(f"Unread emails: {len(df) - df['is_read'].sum()}")

# Visualization
plt.figure(figsize=(12, 4))

plt.subplot(1, 3, 1)
df['category'].value_counts().plot(kind='bar', title='Emails by Category')
plt.xticks(rotation=45)

plt.subplot(1, 3, 2)
df['sender'].value_counts().plot(kind='bar', title='Emails by Sender')
plt.xticks(rotation=45)

plt.subplot(1, 3, 3)
plt.hist(df['size_kb'], bins=10, edgecolor='black')
plt.title('Email Size Distribution')
plt.xlabel('Size (KB)')

plt.tight_layout()
plt.show()