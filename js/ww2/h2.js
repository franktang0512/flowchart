var title = "抽獎";
var question = "有一台抽獎機，可以多次投入抽獎券增加抽獎機會，更有機會拿大獎。隨機抽出獎項後(1~100)，顯示抽到的最大獎項。";
var array = [
    ["抽中號碼", "獎項"],
    ["1", "頭獎"],
    ["2~3", "二獎"],
    ["4~10", "三獎"],
    ["11~100", "四獎"]
]
var test_case = [
    {
        input: "5\n3 5 6 7 8",
        output: "二獎",
        note: "投入5張抽獎券，抽到號碼為3號、5號、6號、7號、8號，最大獎為二獎"
    },
    {
        input: "3\n90 30 1",
        output: "頭獎",
        note: "投入3張抽獎券，抽到號碼為90號、30號、1號，最大獎為頭獎"
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