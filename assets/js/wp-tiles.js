(function($){
  // Public methods
  $.wptiles = {
    // debounce utility from underscorejs.org
    debounce: function(func, wait, immediate) {
        var timeout;
        return function() {
          var context = this, args = arguments;
          var later = function() {
            timeout = null;
            if (!immediate) func.apply(context, args);
          };
          if (immediate && !timeout) func.apply(context, args);
          clearTimeout(timeout);
          timeout = setTimeout(later, wait);
        };
    },
    resizeParent: function($el, padding) {
      var lastEl = $el.children().last(),
          tileOffsetTop = parseInt ( $el.offset().top ),
          newHeight = parseInt(lastEl.css("height"), 10) + parseInt(lastEl.offset().top, 10) - tileOffsetTop + parseInt(padding) + "px";

      $el.parent('.wp-tiles-container').css('height', newHeight );
    }
  };

  $.fn.extend({
    wptiles: function(opts){
      var
          // Locals
          $el = $(this),
          $templates = $("#" + opts.id + "-templates"),
          $templateButtons = $('.template', $templates),
          grid,
          curr_large_template = false,
          using_small = false,

          // Private Methods
          get_first_grid = function(){
            var grid;

            $.each(opts.grids, function() {
              grid = this;
              return false;
            });

            return grid;
          },

          get_template = function(){
            var is_small;

            // First run?
            if ( !curr_large_template )
              curr_large_template = get_first_grid();

            // Setup for responsiveness?
            if ( !opts.breakpoint )
              return curr_large_template;

            is_small = $el.width() < opts.breakpoint;

            if ( is_small && !using_small ) {
                $templates.hide();

                // Save large template
                using_small = true;
                return opts.small_screen_grid;

            } else if ( !is_small && using_small ) {
                $templates.show();
                using_small = false;

                return curr_large_template;
            }

            return ( is_small ) ? opts.small_screen_grid : curr_large_template;
          },

          set_template = function(template){
            curr_large_template = template;
            grid.template = template;
          },

          onresize = function(){
            $.wptiles.resizeParent($el,opts.padding);
            $('.wp-tiles-byline').dotdotdot();

            $el.trigger('wp-tiles:resize');
          };

      // Init the grids
      if ( opts.breakpoint )
        opts.small_screen_grid = Tiles.Template.fromJSON(opts.small_screen_grid);

      var grids = {};
      $.each(opts.grids,function(key){
        grids[key] = Tiles.Template.fromJSON(this);
      });

      opts.grids = grids;

      // Setup the Tiles grid
      grid = $.extend(new Tiles.Grid($el),{
        cellPadding: parseInt(opts.padding),

        template: get_template(),

        templateFactory: {
            get: function(numCols, numTiles) {
              //var numRows      = Math.ceil(numTiles / numCols),
              var template     = get_template().copy(),
                  missingRects = numTiles - template.rects.length;

              while (missingRects > 0) {
                var copyRects = [],
                    i, t = get_template().copy();

                if ( missingRects <= t.rects.length ) {
                  copyRects = t.rects;
                  missingRects = 0;

                } else {
                  for (i = 0; i < t.rects.length; i++) {
                    copyRects.push(t.rects[i].copy());
                  }

                  missingRects -= t.rects.length;
                }

                template.append(
                  new Tiles.Template(copyRects, t.numCols, t.numRows)
                );
              }

              return template;
            }
        },

        resizeColumns: function() {
          return this.template.numCols;
        },

        createTile: function(data) {
          var tile = new Tiles.Tile(data.id,data),
              $el  = tile.$el,
              i    = parseInt(data.id.match(/[0-9]{1,}/)),
              // @todo Custom colors using data-attributes?
              color = opts.colors[i % opts.colors.length];

          $el
            .css("background-color", color);

          // Is this an image tile?
          if ( $('.wp-tiles-tile-with-image',$el).get(0) ) {

            // Then maybe also add the color to the byline
            if ( 'random' === opts.byline_color ) {

              var $byline  = $('.wp-tiles-byline',$el),
                  alpha = opts.byline_opacity,
                  //rgb   = $byline.css('background-color'),
                  rgb   = color,
                  rgbx  = rgb.substr(0,4) === 'rgba' ? rgb : rgb.replace('rgb', 'rgba').replace(')', ',' + alpha + ')'),
                  comma = rgbx.lastIndexOf(','),
                  rgba  = rgbx.slice(0, comma + 1) + alpha + ")";

              $byline.css("background-color", rgba);

            }

            // Set the background image
            var $bg_img = $('.wp-tiles-tile-bg .wp-tiles-img',$el);
            $('.wp-tiles-tile-bg',$el).css('background-image', 'url("'+$bg_img.attr('src')+'")');
            $bg_img.remove();
          }

          return tile;
        }
      });

      // Pass the post tiles into Tiles.js
      var $posts = $('.wp-tiles-tile',$el);
      grid.updateTiles($posts);

      // Maybe do some work with bylies
      var $image_bylines = $('.wp-tiles-tile-with-image .wp-tiles-byline', $el);
      if ( $image_bylines.get(0) ) {

        // Set color and opacity
        if ( 'random' !== opts.byline_color ) {
          $image_bylines.css('background-color', opts.byline_color); // Byline color includes alpha
        }

        // Set the byline height
        $image_bylines.css('height',opts.byline_height + '%');
      }

      // Draw!
      grid.redraw(opts.animate_init, onresize);

      // when the window resizes, redraw the grid
      $(window).resize($.wptiles.debounce(function() {
          // @todo Only resize if template is the same?
          grid.template = get_template();

          grid.isDirty = true;
          grid.resize();

          grid.redraw(opts.animate_resize, onresize);
      }, 200));


      // Make the grid changable
      $templateButtons.on('click', function(e) {
        e.preventDefault();

        // unselect all templates
        $templateButtons.removeClass("selected");

        // select the template we clicked on
        $(this).addClass("selected");

        // get the JSON rows for the selection
        var rows = opts.grids[$(this).data('grid')];

        // set the new template and resize the grid
        //grid.template = Tiles.Template.fromJSON(rows);
        set_template(rows);

        grid.isDirty  = true;
        grid.resize();

        grid.redraw(opts.animate_template, onresize);

      });

      opts.grid = grid;
    }
  });

  // Init using vars from wp_localize_script
  $(function(){
    $.each (wptilesdata, function() {
      var tiledata = this,
          $el = $('#' + tiledata.id);

      $el.wptiles(tiledata);
    });

    // @todo Is this really needed?
    $(window).trigger('resize');
  });

})(jQuery);