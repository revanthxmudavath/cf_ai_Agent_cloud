/** @type {import('tailwindcss').Config} */
  export default {
    darkMode: ["class"],
    content: [
      "./index.html",
      "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
      extend: {
        borderRadius: {
          lg: 'var(--radius)',
          md: 'calc(var(--radius) - 2px)',
          sm: 'calc(var(--radius) - 4px)'
        },
        colors: {
          background: 'hsl(var(--background))',
          foreground: 'hsl(var(--foreground))',
          card: {
            DEFAULT: 'hsl(var(--card))',
            foreground: 'hsl(var(--card-foreground))'
          },
          popover: {
            DEFAULT: 'hsl(var(--popover))',
            foreground: 'hsl(var(--popover-foreground))'
          },
          primary: {
            DEFAULT: 'hsl(var(--primary))',
            foreground: 'hsl(var(--primary-foreground))'
          },
          secondary: {
            DEFAULT: 'hsl(var(--secondary))',
            foreground: 'hsl(var(--secondary-foreground))'
          },
          muted: {
            DEFAULT: 'hsl(var(--muted))',
            foreground: 'hsl(var(--muted-foreground))'
          },
          accent: {
            DEFAULT: 'hsl(var(--accent))',
            foreground: 'hsl(var(--accent-foreground))'
          },
          destructive: {
            DEFAULT: 'hsl(var(--destructive))',
            foreground: 'hsl(var(--destructive-foreground))'
          },
          border: 'hsl(var(--border))',
          input: 'hsl(var(--input))',
          ring: 'hsl(var(--ring))',
          chart: {
            '1': 'hsl(var(--chart-1))',
            '2': 'hsl(var(--chart-2))',
            '3': 'hsl(var(--chart-3))',
            '4': 'hsl(var(--chart-4))',
            '5': 'hsl(var(--chart-5))'
          },
          // Custom editorial color palette
          navy: {
            400: 'hsl(220 20% 50%)',
            500: 'hsl(220 20% 40%)',
            600: 'hsl(var(--navy-600))',
            700: 'hsl(var(--navy-700))',
            800: 'hsl(var(--navy-800))',
            900: 'hsl(var(--navy-900))',
            950: 'hsl(var(--navy-950))',
          },
          cream: {
            50: 'hsl(var(--cream-50))',
            100: 'hsl(var(--cream-100))',
            200: 'hsl(var(--cream-200))',
          },
          amber: {
            400: 'hsl(var(--amber-400))',
            500: 'hsl(var(--amber-500))',
            600: 'hsl(var(--amber-600))',
          },
          indigo: {
            50: 'hsl(234 89% 96%)',
            100: 'hsl(234 89% 92%)',
            200: 'hsl(234 89% 84%)',
            400: 'hsl(var(--indigo-400))',
            500: 'hsl(var(--indigo-500))',
            600: 'hsl(var(--indigo-600))',
            700: 'hsl(234 89% 44%)',
          },
        }
      }
    },
    plugins: [],
  }