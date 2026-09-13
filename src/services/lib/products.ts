import { supabase } from "./supabase"
import { getBlockedUserIds } from "./moderationService"

export interface Product {
  id: string
  title: string
  description: string
  price: number
  category: string
  condition: string
  location?: string
  images: string[]
  seller_id: string
  status: string
  created_at: string
  updated_at: string
  view_count?: number
  seller?: {
    full_name: string
    avatar_url?: string
    is_verified_seller?: boolean
    rating_avg?: number | null
    rating_count?: number
  }
  isWishlisted?: boolean
}


export interface UserProfile {
  id: string
  full_name: string
  avatar_url?: string
  phone?: string
  address?: string
  created_at: string
  updated_at: string
}

export const productService = {
  // Create a new product
  createProduct: async (productData: {
    title: string
    description: string
    price: number
    category: string
    condition: string
    location?: string
    images: string[]
  }) => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw new Error("User not authenticated")

    const { location, ...payload } = productData;
    const fullDescription = location ? `${payload.description.trim()}\n\n📍 ${location}` : payload.description.trim();

    const { data, error } = await supabase
      .from("products")
      .insert([
        {
          ...payload,
          description: fullDescription,
          seller_id: user.id,
          status: "active",
        },
      ])
      .select()
      .single()

    if (error) throw error
    return data
  },

  // Get all active products with seller info (REVERTED TO WORKING VERSION)
  getProducts: async (filters?: {
    category?: string
    search?: string
    minPrice?: number
    maxPrice?: number
    condition?: string[]
  }) => {
    // First, query products
    let query = supabase.from("products").select("*").eq("status", "active").order("created_at", { ascending: false })

    if (filters?.category && filters.category !== "All Categories") {
      query = query.ilike("category", filters.category)
    }
    if (filters?.search) {
      query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`)
    }
    if (filters?.minPrice !== undefined) {
      query = query.gte("price", filters.minPrice)
    }
    if (filters?.maxPrice !== undefined) {
      query = query.lte("price", filters.maxPrice)
    }
    if (filters?.condition && filters.condition.length > 0) {
      query = query.in("condition", filters.condition)
    }

    const { data: products, error } = await query

    if (error) throw error

    // If we have products, fetch the seller profiles
    if (products && products.length > 0) {
      const sellerIds = [...new Set(products.map((product) => product.seller_id))]

      const { data: profiles, error: profilesError } = await supabase
        .from("public_profiles")
        .select("id, full_name, avatar_url, is_verified_seller, rating_avg, rating_count")
        .in("id", sellerIds)

      if (profilesError) throw profilesError

      const sellerProfiles = profiles
        ? profiles.reduce(
            (map, profile) => {
              map[profile.id] = profile
              	return map
            },
            {} as Record<string, { id: string; full_name: string; avatar_url?: string; is_verified_seller?: boolean; rating_avg?: number | null; rating_count?: number }>,
      	)
        : {}

      const {
        data: { user },
      } = await supabase.auth.getUser()

      let wishlistedProductIds: string[] = []
      if (user) {
        try {
          const { data: wishlistItems } = await supabase.from("wishlists").select("product_id").eq("user_id", user.id)
          wishlistedProductIds = wishlistItems?.map((item) => item.product_id) || []
        } catch (error) {
          console.warn("Could not fetch wishlist items:", error)
        }
      }

      // Guideline 1.2: blocking a seller hides their listings from this viewer.
      const blocked = await getBlockedUserIds().catch(() => new Set<string>())

      const productsWithSellers = products
        .filter((product) => !blocked.has(product.seller_id))
        .map((product) => ({
          ...product,
          seller: sellerProfiles[product.seller_id] || { full_name: "Unknown Seller" },
          isWishlisted: wishlistedProductIds.includes(product.id),
        }))

      return productsWithSellers as Product[]
    }

    return products as Product[]
  },

  // Get product by ID
  getProductById: async (productId: string) => {
    const { data: product, error } = await supabase.from("products").select("*").eq("id", productId).single()

    if (error) throw error

    if (product) {
      const { data: sellerProfile, error: profileError } = await supabase
        .from("public_profiles")
        .select("id, full_name, avatar_url, is_verified_seller, rating_avg, rating_count")
        .eq("id", product.seller_id)
        .single()

      if (profileError && profileError.code !== "PGRST116") throw profileError

      const {
        data: { user },
      } = await supabase.auth.getUser()

      let isWishlisted = false
      if (user) {
        try {
          const { data: wishlistItem } = await supabase
            .from("wishlists")
            .select("id")
            .eq("user_id", user.id)
          	.eq("product_id", productId)
          	.maybeSingle()
        	isWishlisted = !!wishlistItem
        } catch (error) {
          console.warn("Error in wishlist check:", error)
        }
      }

      return {
        ...product,
        seller: sellerProfile || { full_name: "Unknown Seller" },
        isWishlisted,
      } as Product
    }

    return product as Product
  },

  // Get products by seller
  getProductsBySeller: async (sellerId: string) => {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("seller_id", sellerId)
      .order("created_at", { ascending: false })

    if (error) throw error
    return data as Product[]
  },

  // Update product
  updateProduct: async (productId: string, updates: Partial<Product>) => {
    const { data, error } = await supabase
      .from("products")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", productId)
      .select()
      .single()

    if (error) throw error
    return data
  },

  // Delete product
  /**
   * Removes a listing. A listing that has an order cannot be deleted --
   * orders.product_id is ON DELETE RESTRICT so paid escrow records can never
   * vanish with the product -- so those are withdrawn instead (status
   * 'removed'; the public SELECT policy only shows 'active'). Returns which
   * of the two happened so the UI can say so.
   */
  deleteProduct: async (productId: string): Promise<'deleted' | 'withdrawn'> => {
    const { error } = await supabase.from("products").delete().eq("id", productId)
    if (!error) return 'deleted'
    if (error.code !== '23503') throw error
    const { error: updErr } = await supabase
      .from("products")
      .update({ status: 'removed', updated_at: new Date().toISOString() })
      .eq("id", productId)
    if (updErr) throw updErr
    return 'withdrawn'
  },

  // Add product to wishlist
  addToWishlist: async (productId: string) => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw new Error("User not authenticated")

    const { data, error } = await supabase
      .from("wishlists")
      .insert([{ user_id: user.id, product_id: productId, updated_at: new Date().toISOString() }])
      .select()
      .single()
    if (error) {
    	if (error.code === "23505") return { alreadyExists: true } // Already in wishlist
    	throw error
    }
    return data
  },

  // Remove product from wishlist
  removeFromWishlist: async (productId: string) => {
  	const { data: { user } } = await supabase.auth.getUser()
  	if (!user) throw new Error("User not authenticated")
  	const { error } = await supabase.from("wishlists").delete().eq("user_id", user.id).eq("product_id", productId)
  	if (error) throw error
  	return true
  },
   deleteProductImages: async (images: string[]) => {
    if (!images || images.length === 0) {
      return; // Nothing to do
    }

    // Extract the file paths from the full URLs
    const filePaths = images.map(url => {
      try {
        const { pathname } = new URL(url);
        // The path is everything after the bucket name
        const path = pathname.split('/product-images/')[1];
        return path;
      } catch (error) {
        console.warn(`Invalid image URL found, cannot delete: ${url}`);
        return null;
      }
    }).filter((path): path is string => path !== null);

    if (filePaths.length > 0) {
      const { data, error } = await supabase.storage
        .from('product-images')
        .remove(filePaths);

      if (error) {
        console.error("Error deleting storage images:", error);
        throw error; // Let the calling function know something went wrong
      }
      console.log("Successfully deleted images from storage:", data);
    }
  },

  // Get user's wishlist
  getWishlist: async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return []

    const { data: wishlistItems, error } = await supabase
      .from("wishlists")
      .select("product_id")
      .eq("user_id", user.id)

    if (error || !wishlistItems || wishlistItems.length === 0) {
    	if (error) console.error("Error fetching wishlist items:", error)
    	return []
    }

    const productIds = wishlistItems.map((item) => item.product_id)
    const { data: products, error: productsError } = await supabase
    	.from("products")
    	.select("*")
    	.in("id", productIds)

  	if (productsError) {
  		console.error("Error fetching wishlist products:", productsError)
  		return []
  	}
  	if (!products || products.length === 0) return []

  	const sellerIds = [...new Set(products.map((product) => product.seller_id))]
  	const { data: profiles, error: profilesError } = await supabase
  		.from("public_profiles")
  		.select("id, full_name, avatar_url, is_verified_seller, rating_avg, rating_count")
  		.in("id", sellerIds)

  	if (profilesError) {
  		console.error("Error fetching seller profiles for wishlist:", profilesError)
  		// Return products without seller info as a fallback
  		return products.map(p => ({...p, isWishlisted: true})) as Product[]
  	}

  	const sellerProfiles = profiles
  		? profiles.reduce(
  			(map, profile) => {
  				map[profile.id] = profile
  				return map
  			},
  			{} as Record<string, { id: string; full_name: string; avatar_url?: string }>,
  		)
  		: {}

  	return products.map((product) => ({
  		...product,
  		seller: sellerProfiles[product.seller_id] || { full_name: "Unknown Seller" },
  		isWishlisted: true,
  	})) as Product[]
  },

  // Get sold product count for a seller
  getSoldCountBySeller: async (sellerId: string): Promise<number> => {
    const { count, error } = await supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('seller_id', sellerId)
      .eq('status', 'sold')
    if (error) {
      console.warn('getSoldCountBySeller error:', error)
      return 0
    }
    return count ?? 0
  },

  // Get similar products in the same category
  getSimilarProducts: async (category: string, excludeProductId: string, limit = 6): Promise<Product[]> => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('status', 'active')
        .ilike('category', category)
        .neq('id', excludeProductId)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) {
        console.warn('getSimilarProducts error:', error)
        return []
      }
      return (data || []) as Product[]
    } catch (e) {
      console.warn('getSimilarProducts exception:', e)
      return []
    }
  },
}

export const profileService = {
  getProfile: async (userId: string) => {
    const { data, error } = await supabase.from("user_profiles").select("*").eq("id", userId).single();
    if (error && error.code !== "PGRST116") throw error;
    return data as UserProfile | null;
  },

  // This replaces the buggy 'upsertProfile' function
  updateProfile: async (userId: string, updates: Partial<UserProfile>) => {
    // Clients have no UPDATE grant on user_profiles or public_profiles any
    // more (20260910120000 closed the self-verification hole). The only write
    // path is update_my_profile, which takes exactly the user-owned fields and
    // ignores everything else -- tier, is_verified_seller, ratings cannot be
    // passed through here by construction.
    const { error } = await supabase.rpc('update_my_profile', {
      p_full_name: updates.full_name ?? null,
      p_phone: updates.phone ?? null,
      p_avatar_url: updates.avatar_url ?? null,
    })
    if (error) throw error
    return profileService.getProfile(userId)
  },

};