if (!customElements.get('product-info')) {
  customElements.define(
    'product-info',
    class ProductInfo extends HTMLElement {
      constructor() {
        super();
        this.input = this.querySelector('.quantity__input');
        this.currentVariant = this.querySelector('.product-variant-id');
        this.submitButton = this.querySelector('[type="submit"]');
      }

      cartUpdateUnsubscriber = undefined;
      variantChangeUnsubscriber = undefined;

      connectedCallback() {
        if (!this.input) return;
        this.quantityForm = this.querySelector('.product-form__quantity');
        if (!this.quantityForm) return;
        this.setQuantityBoundries();
        if (!this.dataset.originalSection) {
          this.cartUpdateUnsubscriber = subscribe(PUB_SUB_EVENTS.cartUpdate, this.fetchQuantityRules.bind(this));
        }
        this.variantChangeUnsubscriber = subscribe(PUB_SUB_EVENTS.variantChange, (event) => {
          const sectionId = this.dataset.originalSection ? this.dataset.originalSection : this.dataset.section;
          if (event.data.sectionId !== sectionId) return;
          this.updateQuantityRules(event.data.sectionId, event.data.html);
          this.setQuantityBoundries();
        });
      }

      disconnectedCallback() {
        if (this.cartUpdateUnsubscriber) {
          this.cartUpdateUnsubscriber();
        }
        if (this.variantChangeUnsubscriber) {
          this.variantChangeUnsubscriber();
        }
      }

      setQuantityBoundries() {
        const data = {
          cartQuantity: this.input.dataset.cartQuantity ? parseInt(this.input.dataset.cartQuantity) : 0,
          min: this.input.dataset.min ? parseInt(this.input.dataset.min) : 1,
          max: this.input.dataset.max ? parseInt(this.input.dataset.max) : null,
          step: this.input.step ? parseInt(this.input.step) : 1,
        };

        let min = data.min;
        const max = data.max === null ? data.max : data.max - data.cartQuantity;
        if (max !== null) min = Math.min(min, max);
        if (data.cartQuantity >= data.min) min = Math.min(min, data.step);

        this.input.min = min;
        this.input.max = max;
        this.input.value = min;
        publish(PUB_SUB_EVENTS.quantityUpdate, undefined);
      }

      fetchQuantityRules() {
        if (!this.currentVariant || !this.currentVariant.value) return;
        this.querySelector('.quantity__rules-cart .loading__spinner').classList.remove('hidden');
        fetch(`${this.dataset.url}?variant=${this.currentVariant.value}&section_id=${this.dataset.section}`)
          .then((response) => {
            return response.text();
          })
          .then((responseText) => {
            const html = new DOMParser().parseFromString(responseText, 'text/html');
            this.updateQuantityRules(this.dataset.section, html);
            this.setQuantityBoundries();
          })
          .catch((e) => {
            console.error(e);
          })
          .finally(() => {
            this.querySelector('.quantity__rules-cart .loading__spinner').classList.add('hidden');
          });
      }

      updateQuantityRules(sectionId, html) {
        const quantityFormUpdated = html.getElementById(`Quantity-Form-${sectionId}`);
        const selectors = ['.quantity__input', '.quantity__rules', '.quantity__label'];
        for (let selector of selectors) {
          const current = this.quantityForm.querySelector(selector);
          const updated = quantityFormUpdated.querySelector(selector);
          if (!current || !updated) continue;
          if (selector === '.quantity__input') {
            const attributes = ['data-cart-quantity', 'data-min', 'data-max', 'step'];
            for (let attribute of attributes) {
              const valueUpdated = updated.getAttribute(attribute);
              if (valueUpdated !== null) current.setAttribute(attribute, valueUpdated);
            }
          } else {
            current.innerHTML = updated.innerHTML;
          }
        }
      }
    }
  );
}


if (window.jQuery) {
$(document).ready(function(){
  var prevArrow = `<button class="slick-prev slick-arrow" type="button"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"><g clip-path="url(#clip0_1_981)"><path d="M10.8283 12L15.7783 7.04999L14.3643 5.63599L8.00032 12L14.3643 18.364L15.7783 16.95L10.8283 12Z" fill="black"/></g><defs><clipPath id="clip0_1_981"><rect width="24" height="24" fill="white" transform="matrix(-1 0 0 1 24 0)"/></clipPath></defs></svg></button>`;
  var nextArrow = `<button class="slick-next slick-arrow" type="button"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"><g clip-path="url(#clip0_1_976)"><path d="M13.1717 12L8.22168 7.04999L9.63568 5.63599L15.9997 12L9.63568 18.364L8.22168 16.95L13.1717 12Z" fill="black"/></g><defs><clipPath id="clip0_1_976"><rect width="24" height="24" fill="white"/></clipPath></defs></svg></button>`;

   $('.main-nav-slider').slick({
    slidesToShow: 1,
    slidesToScroll: 1,
    arrows: true,
    fade: true,
    prevArrow: prevArrow,
    nextArrow: nextArrow,
    asNavFor: '.thumbnail-nav-slider'
  });
  $('.thumbnail-nav-slider').slick({
    slidesToShow: 6,
    slidesToScroll: 1,
    infinite: true,
    asNavFor: '.main-nav-slider',
    dots: false,
    arrows: true,
    prevArrow: prevArrow,
    nextArrow: nextArrow,
    centerMode: false,
    focusOnSelect: true,
    responsive: [
    {
      breakpoint: 1024,
      settings: {
        slidesToShow: 4
      }
    }
   ]
  });

  if($(window).width() >= 1024){
   if($('.thumbnail-nav-slider.slick-initialized .thumbnail-list__item').length <= 6){
     $('.thumbnail-nav-slider.slick-initialized').attr('disable-slider','true');
   }else{
     $('.thumbnail-nav-slider.slick-initialized').attr('disable-slider','false');
   }
  }else{
   if($('.thumbnail-nav-slider.slick-initialized .thumbnail-list__item').length <= 4){
     $('.thumbnail-nav-slider.slick-initialized').attr('disable-slider','true');
   }else{
     $('.thumbnail-nav-slider.slick-initialized').attr('disable-slider','false');
   }
  }
  
});
}

if (window.jQuery) {
$(document).on('click','.card-swatch-item a',function(){
  var currentVal = $(this).attr('data-id');
  if(currentVal != undefined){
    console.log(currentVal)
    $(this).closest('.product-card-wrapper').find('.quick-add .product-variant-id').attr('value',currentVal);
    $('.card-swatch-item a').removeClass('is--active');
    $(this).addClass('is--active');
  }
});
}