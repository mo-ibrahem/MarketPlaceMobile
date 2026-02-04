import { Picker } from "@react-native-picker/picker";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { Upload, X } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { useAuth } from "../../hooks/useAuth";
import { productService } from "../../src/services/lib/products";
import { supabase } from "../../src/services/lib/supabase";

const categories = [
  "Electronics",
  "Fashion",
  "Home",
  "Toys",
  "Books",
  "Sports",
  "Beauty",
  "Automotive",
];

export default function SellScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [productData, setProductData] = useState({
    title: "",
    description: "",
    price: "",
    category: "Electronics",
    condition: "New",
  });
  const [images, setImages] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      if (Platform.OS !== "web") {
        const { status } =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
          // Optional logic for permission denial
        }
      }
    })();
  }, []);

  const handlePickImage = async () => {
    const permissionResult =
      await ImagePicker.getMediaLibraryPermissionsAsync();

    if (permissionResult.granted === false) {
      // Use Alert instead of Toast here so we can have a button
      Alert.alert(
        "Permission Required",
        "We need access to your photos to upload product images. Please enable it in settings.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Open Settings",
            onPress: () => Linking.openSettings(), // This opens the phone settings directly
          },
        ],
      );
      return;
    }

    const pickerResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsMultipleSelection: true,
      quality: 0.6,
    });

    if (!pickerResult.canceled) {
      setImages((prev) => [...prev, ...pickerResult.assets]);
    }
  };

  const handleRemoveImage = (indexToRemove: number) => {
    setImages((prevImages) =>
      prevImages.filter((_, index) => index !== indexToRemove),
    );
  };

  const uploadImage = async (image: ImagePicker.ImagePickerAsset) => {
    if (!image.uri) throw new Error("No image URI");
    const arraybuffer = await fetch(image.uri).then((res) => res.arrayBuffer());
    const fileExt = image.uri.split(".").pop()?.toLowerCase() ?? "jpeg";
    const path = `${user!.id}/${Date.now()}.${fileExt}`;

    const { error } = await supabase.storage
      .from("product-images")
      .upload(path, arraybuffer, {
        contentType: `image/${fileExt}`,
      });
    if (error) throw error;

    const {
      data: { publicUrl },
    } = supabase.storage.from("product-images").getPublicUrl(path);
    return publicUrl;
  };

  const handleSellProduct = async () => {
    if (!user) {
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "You must be logged in to sell a product.",
      });
      return;
    }
    if (
      !productData.title ||
      !productData.price ||
      !productData.category ||
      images.length === 0
    ) {
      Toast.show({
        type: "error",
        text1: "Missing Fields",
        text2: "Please fill in all fields and add an image.",
      });
      return;
    }

    setLoading(true);
    try {
      const imageUrls = await Promise.all(
        images.map((image) => uploadImage(image)),
      );
      await productService.createProduct({
        ...productData,
        price: parseFloat(productData.price),
        images: imageUrls,
      });

      Toast.show({
        type: "success",
        text1: "Success!",
        text2: "Your product has been listed.",
      });

      router.back();
    } catch (error: any) {
      console.error("Failed to list product:", error);
      Toast.show({
        type: "error",
        text1: "Error",
        text2: error.message || "Failed to list product.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    // FIX 1: Added 'top' to edges to prevent status bar collision
    <SafeAreaView
      style={styles.safeArea}
      edges={["top", "bottom", "left", "right"]}
    >
      <ScrollView contentContainerStyle={styles.container}>
        {/* FIX 2: Added the Title Header */}
        <Text style={styles.headerTitle}>Sell Your Item</Text>

        <Text style={styles.label}>Product Title</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g., iPhone 14 Pro"
          value={productData.title}
          onChangeText={(text) =>
            setProductData({ ...productData, title: text })
          }
        />

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Describe your item in detail..."
          value={productData.description}
          onChangeText={(text) =>
            setProductData({ ...productData, description: text })
          }
          multiline
        />

        <Text style={styles.label}>Price ($)</Text>
        <TextInput
          style={styles.input}
          placeholder="0.00"
          value={productData.price}
          onChangeText={(text) =>
            setProductData({ ...productData, price: text })
          }
          keyboardType="numeric"
        />

        <Text style={styles.label}>Category</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={productData.category}
            onValueChange={(itemValue) =>
              setProductData({ ...productData, category: itemValue })
            }
            itemStyle={styles.pickerItem}
          >
            {categories.map((cat) => (
              <Picker.Item key={cat} label={cat} value={cat} />
            ))}
          </Picker>
        </View>

        <Text style={styles.label}>Condition</Text>
        <View style={styles.segmentedControlContainer}>
          <TouchableOpacity
            style={[
              styles.segmentedControlButton,
              productData.condition === "New" && styles.activeSegment,
            ]}
            onPress={() => setProductData({ ...productData, condition: "New" })}
          >
            <Text
              style={[
                styles.segmentedControlText,
                productData.condition === "New" && styles.activeSegmentText,
              ]}
            >
              New
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.segmentedControlButton,
              productData.condition === "Used" && styles.activeSegment,
            ]}
            onPress={() =>
              setProductData({ ...productData, condition: "Used" })
            }
          >
            <Text
              style={[
                styles.segmentedControlText,
                productData.condition === "Used" && styles.activeSegmentText,
              ]}
            >
              Used
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Upload Images</Text>
        <TouchableOpacity style={styles.imagePicker} onPress={handlePickImage}>
          <Upload color="#4B5563" size={24} />
          <Text style={styles.imagePickerText}>Select Photos</Text>
        </TouchableOpacity>

        <View style={styles.imagePreviewContainer}>
          {images.map((image, index) => (
            <View key={index} style={styles.imageWrapper}>
              <Image source={{ uri: image.uri }} style={styles.imagePreview} />
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => handleRemoveImage(index)}
              >
                <X size={14} color="white" />
              </TouchableOpacity>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={styles.submitButton}
          onPress={handleSellProduct}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.submitButtonText}>List Product</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "white" },
  container: { padding: 20 },
  // Fix 3: Added header style
  headerTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 24,
    textAlign: "center",
  },
  label: { fontSize: 16, fontWeight: "600", color: "#374151", marginBottom: 8 },
  input: {
    backgroundColor: "#F9FAFB",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    fontSize: 16,
    marginBottom: 20,
  },
  textArea: { height: 120, textAlignVertical: "top" },
  pickerContainer: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 20,
    justifyContent: "center",
  },
  pickerItem: { color: "black", height: 120 },
  segmentedControlContainer: {
    flexDirection: "row",
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  segmentedControlButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 8,
  },
  activeSegment: {
    backgroundColor: "white",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  segmentedControlText: { fontSize: 16, color: "#4B5563" },
  activeSegmentText: { fontWeight: "600", color: "#1F2937" },
  imagePicker: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F4F6",
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  imagePickerText: { fontSize: 16, color: "#4B5563", marginLeft: 8 },
  imagePreviewContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 20,
  },
  imageWrapper: { position: "relative" },
  imagePreview: { width: 80, height: 80, borderRadius: 8 },
  removeButton: {
    position: "absolute",
    top: -5,
    right: -5,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  submitButton: {
    backgroundColor: "#16A34A",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 20,
  },
  submitButtonText: { color: "white", fontSize: 18, fontWeight: "bold" },
});
