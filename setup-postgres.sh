#!/bin/bash

# Quick PostgreSQL Setup Script
# Run this after installing PostgreSQL

set -e

echo "🚀 KendraBindu AI PostgreSQL Setup"
echo "============================\n"

# Detect OS
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "📱 Detected macOS"
    
    if ! command -v brew &> /dev/null; then
        echo "❌ Homebrew not found. Install from https://brew.sh"
        exit 1
    fi
    
    if ! command -v psql &> /dev/null; then
        echo "📦 Installing PostgreSQL via Homebrew..."
        brew install postgresql
    fi
    
    echo "🔧 Starting PostgreSQL service..."
    brew services start postgresql
    
    echo "✅ PostgreSQL started"
    
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    echo "🐧 Detected Linux"
    
    if ! command -v psql &> /dev/null; then
        echo "📦 Installing PostgreSQL..."
        sudo apt update
        sudo apt install -y postgresql postgresql-contrib
    fi
    
    echo "🔧 Starting PostgreSQL service..."
    sudo systemctl start postgresql
    
    echo "✅ PostgreSQL started"
fi

echo "\n📝 Setting up database..."

# Create database and user
if psql postgres -tAc "SELECT 1 FROM pg_database WHERE datname='jobmailer'" | grep -q 1; then
    echo "⚠️  Database 'jobmailer' already exists"
else
    echo "Creating database..."
    psql postgres -c "CREATE DATABASE jobmailer;"
    echo "✅ Database created"
fi

echo "\n📋 Database ready!"
echo ""
echo "Next steps:"
echo "1. Update .env with database credentials:"
echo "   DB_HOST=localhost"
echo "   DB_PORT=5432"
echo "   DB_USER=postgres"
echo "   DB_NAME=jobmailer"
echo ""
echo "2. Run the application:"
echo "   ./run.sh"
echo ""
echo "3. Check PostgreSQL status:"
echo "   psql -U postgres -d jobmailer -c 'SELECT 1;'"
echo ""
