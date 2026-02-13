from PIL import Image, ImageDraw, ImageFont
import os

def create_og_image():
    # Configuration
    output_path = "Assets/og-logo-card.png"
    logo_path = "Assets/best-large-fill-2.png"
    canvas_size = (1200, 630)
    bg_color = (255, 255, 255) # White
    logo_target_height = 300 # Slightly smaller to make room for text
    
    text_content = "Top Notch Gifts"
    font_size = 80
    # Mac system font
    font_path = "/System/Library/Fonts/HelveticaNeue.ttc" 
    text_color = (0, 0, 0) # Black
    spacing = 30 # Space between logo and text

    # Create canvas
    img = Image.new('RGB', canvas_size, color=bg_color)
    draw = ImageDraw.Draw(img)
    
    try:
        # Load Font
        try:
            # Index 1 is often Bold for TTC collections, but 0 is safe default
            font = ImageFont.truetype(font_path, font_size, index=1) 
        except:
            print("Could not load specified font, falling back to default.")
            font = ImageFont.load_default()

        # Open logo
        logo = Image.open(logo_path)
        
        # Calculate new dimensions keeping aspect ratio
        aspect_ratio = logo.width / logo.height
        new_height = logo_target_height
        new_width = int(new_height * aspect_ratio)
        
        # Resize logo
        logo = logo.resize((new_width, new_height), Image.Resampling.LANCZOS)
        
        # Measure text to center it
        try:
            left, top, right, bottom = draw.textbbox((0, 0), text_content, font=font)
            text_width = right - left
            text_height = bottom - top
        except AttributeError:
             # Fallback for older Pillow versions
            text_width, text_height = draw.textsize(text_content, font=font)

        # Calculate total content height and starting Y
        total_height = new_height + spacing + text_height
        start_y = (canvas_size[1] - total_height) // 2
        
        # Calculate positions
        logo_x = (canvas_size[0] - new_width) // 2
        logo_y = start_y
        
        text_x = (canvas_size[0] - text_width) // 2
        # Adjust text_y to account for font ascent/descent visual centering if needed, 
        # but simple stacking is usually fine.
        text_y = logo_y + new_height + spacing

        # Paste logo
        if logo.mode == 'RGBA':
            img.paste(logo, (logo_x, int(logo_y)), logo)
        else:
            img.paste(logo, (logo_x, int(logo_y)))
            
        # Draw Text
        draw.text((text_x, text_y), text_content, font=font, fill=text_color)
            
        # Save
        img.save(output_path)
        print(f"Successfully created {output_path}")
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    create_og_image()
