import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['sharp', '@imgly/background-removal-node'],
  turbopack: {
    root: __dirname,
  },
}

export default nextConfig
