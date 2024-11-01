var title = "腳踏車";
var question = "腳踏車出租店有兩種費率，4小時以內(含4小時)為每小時10元；4小時以上為每小時15元。請根據租車時間，計算總租金。\n";
var array = [
    /*["夜市牛排", "200"],
    ["藥燉排骨", "120"],
    ["炸雞排", "60"],
    ["奶茶", "55"],
    ["臭豆腐", "40"],
    ["地瓜球", "30"]*/
]
var test_case = [
    {
        input: "3",
        output: "30",
        note: "租車3小時，以四小時以內費率收費，為每小時10元。租金為3*10 = 30元。"
    },
	{
        input: "5",
        output: "75",
        note: "租車5小時，以四小時以上費率收費，為每小時15元。租金為5*15 = 75元。"
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
                <td style="width: 20%;">'+test_case[i].input+'</td>\
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