const $ = jQuery;
$(document).ready(function () {
    $("#spotmap-add-feed-button").click(function () {
        const api = $('#spotmap-add-feed-select').find(":selected").val();
        console.log('test'+api)
        if (api == 'findmespot') {
            var table = $("#findmespot-feeds").next().children();
            if (table.length) {
                index = table.children().length / 3;
                console.log(index)
                var clone = table.children().slice(0, 3).clone(true, true);
                console.log(clone)
                clone.children().find('input').attr('value', '');
                var inputs = clone.children().next();

                inputs.each(function () {
                    console.log('test');
                    let name = $(this).children().attr('name');
                    newName = name.replace('[0]', '[' + index + ']');
                    $(this).children().attr('name', newName)
                });
                table.append(clone)
            } else{
                $("h2").before().append($(`<h2>Spot Feed</h2><p id="findmespot-feeds">Here goes a detailed description.</p><table class="form-table" role="presentation"><tbody><tr><th scope="row">Feed Name</th><td>		<input type="text" name="spotmap_findmespot_name[0]" value="thomas2">
                </td></tr><tr><th scope="row">Feed Id</th><td>		<input type="text" name="spotmap_findmespot_id[0]" value="1tlhEnM93QSE5jxq7tf2p4hFcipcetZN2">
                </td></tr><tr><th scope="row">Feed password</th><td>		<input type="password" name="spotmap_findmespot_password[0]" value="">
                <p class="description">Leave this empty if the feed is public</p>
                </td></tr></tbody></table>`))
            }

        }
    });
    // to update the font awesome preview in the dashboard Marker section
    $(".spotmap-icon-input").change(function(){
        let value = $(this).val()
        let icon = $(this).next();
        icon.removeClass().addClass("fas").addClass("fa-"+value);
        // $("#" + name).attr("class", "fa fa-"+);
    });

});