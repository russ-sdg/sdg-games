function initializePK() {

    score = 0;

      $("#36cards").focus();

    $(".cards").on("change",function() {
        score = $( "#7cards" ).val()*100+$( "#6cards" ).val()*50+$( "#5cards" ).val()*25+$( "#4cards" ).val()*10+$( "#3cards" ).val()*5+$( "#2cards" ).val()*2;
        $("#score").text(score);

    });

  }
