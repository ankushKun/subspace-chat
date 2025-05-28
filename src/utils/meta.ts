interface MetaTagOptions {
    title?: string
    description?: string
    image?: string
    url?: string
    type?: string
    siteName?: string
    imageAlt?: string
    imageWidth?: string
    imageHeight?: string
}

export function updateMetaTags(options: MetaTagOptions) {
    // Update document title
    if (options.title) {
        document.title = options.title
    }

    // Update or create meta tags
    const updateMetaTag = (property: string, content: string) => {
        let meta = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement
        if (!meta) {
            meta = document.createElement('meta')
            meta.setAttribute('property', property)
            document.head.appendChild(meta)
        }
        meta.setAttribute('content', content)
    }

    const updateNameMetaTag = (name: string, content: string) => {
        let meta = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement
        if (!meta) {
            meta = document.createElement('meta')
            meta.setAttribute('name', name)
            document.head.appendChild(meta)
        }
        meta.setAttribute('content', content)
    }

    if (options.title) {
        updateMetaTag('og:title', options.title)
        updateNameMetaTag('twitter:title', options.title)
    }

    if (options.description) {
        updateMetaTag('og:description', options.description)
        updateNameMetaTag('description', options.description)
        updateNameMetaTag('twitter:description', options.description)
    }

    if (options.image) {
        updateMetaTag('og:image', options.image)
        updateNameMetaTag('twitter:image', options.image)

        // Add image dimensions if provided
        if (options.imageWidth) {
            updateMetaTag('og:image:width', options.imageWidth)
        }
        if (options.imageHeight) {
            updateMetaTag('og:image:height', options.imageHeight)
        }
        if (options.imageAlt) {
            updateMetaTag('og:image:alt', options.imageAlt)
            updateNameMetaTag('twitter:image:alt', options.imageAlt)
        }
    }

    if (options.url) {
        updateMetaTag('og:url', options.url)
    }

    if (options.type) {
        updateMetaTag('og:type', options.type)
    }

    if (options.siteName) {
        updateMetaTag('og:site_name', options.siteName)
    }

    // Ensure Twitter card type is set
    updateNameMetaTag('twitter:card', 'summary_large_image')
}

export function resetMetaTags() {
    // Reset to default values
    updateMetaTags({
        title: 'Subspace',
        description: 'Subspace is an intergalactic communication app built on the Permaweb. It allows you to chat in online communities without the fear of censorship.',
        image: `${window.location.origin}/icon-512.png`,
        url: window.location.href,
        type: 'website',
        siteName: 'Subspace',
        imageAlt: 'Subspace - Intergalactic Communication',
        imageWidth: '512',
        imageHeight: '512'
    })
} 