var title = "投籃機";
var question = "有一台投籃機，投進的球皆設定為2分球或3分球。得分超過30分便通關，且會記錄投了幾次球，請完成此投籃機程式，根據每次投球的得分，顯示投了幾顆球。";
var array = [
    /*["抽中號碼", "獎項"],
    ["1", "頭獎"],
    ["2~3", "二獎"],
    ["4~10", "三獎"],
    ["11~100", "四獎"]*/
]
var test_case = [
    {
        input: "2 2 2 2 2 2 3 3 3 3 3 3",
        output: "12",
        note: "投進2分球6顆，3分球6顆後通關。共投了12顆球。"
    },
    {
        input: "2 0 0 0 2 3 3 3 0 0 3 3 3 3 3 3",
        output: "16",
        note: "沒投進5顆，投進2分球2顆，3分球9顆後通關。共投了16顆球。"
    }
]

$(document).ready(function(){
    $("#question_name").text("題目名稱："+title)
    $("#question_info").text(question);
    $("#example_testcase").append(
        '<tr>\
            <th style="width: 20%;">輸入</th>\
            <th style="width: 20%;">輸出</th>\
            <th style="width: 30%;">說明</th>\
        </tr>'
    )    
    for(let i=0;i<test_case.length;i++){
        $("#example_testcase").append(
            '<tr>\
                <td style="width: 20%;">'+test_case[i].input.replaceAll("\n","<br>")+'</td>\
                <td style="width: 20%;">'+test_case[i].output+'</td>\
                <td style="width: 30%;">'+test_case[i].note+'</td>\
            </tr>'
        )  
    }
    for(let i=0;i<array.length;i++){
        $("#array").append(
            '<tr>\
                <td style="width: 20%;">'+array[i][0]+'</td>\
                <td style="width: 20%;">'+array[i][1]+'</td>\
            </tr>'
        )  
    }
    
})